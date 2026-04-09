import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ConversationProvider,
  useConversation,
  useConversationClientTool,
} from "@elevenlabs/react";
import { getSignedUrl } from "@/lib/elevenlabs";
import { createForm } from "@/lib/api";
import { buildFormCreatorPrompt } from "@/lib/prompt";
import type { FieldType, FormField } from "@/types/forms";

// ── Types ────────────────────────────────────────────────────────────────────

type TranscriptEntry = {
  id: string;
  role: "agent" | "user" | "system";
  text: string;
};

type FormDraft = {
  title: string;
  description: string;
  fields: FormField[];
  greeting: string;
  personality: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function emptyDraft(): FormDraft {
  return { title: "", description: "", fields: [], greeting: "", personality: "" };
}

const VALID_TYPES = new Set<string>([
  "text", "long_text", "number", "boolean", "enum",
  "multi_select", "email", "date", "scale", "file",
]);

// ── Voice Orb ───────────────────────────────────────────────────────────────

function VoiceOrb({
  status,
  isSpeaking,
  isListening,
  onClick,
  disabled,
}: {
  status: string;
  isSpeaking: boolean;
  isListening: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  const idle = status === "disconnected";
  const connecting = status === "connecting";
  const active = status === "connected";

  // Determine ring animation
  let ringClass = "scale-100 opacity-0";
  if (connecting) ringClass = "scale-110 opacity-30 animate-pulse";
  else if (isSpeaking) ringClass = "scale-[1.35] opacity-40";
  else if (isListening) ringClass = "scale-[1.2] opacity-20";

  // Determine orb color
  let orbBg = "bg-stone-900";
  if (connecting) orbBg = "bg-stone-700";
  else if (isSpeaking) orbBg = "bg-coral";
  else if (isListening) orbBg = "bg-stone-900";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="relative flex items-center justify-center disabled:cursor-not-allowed"
    >
      {/* Outer pulse ring */}
      <div
        className={`absolute h-32 w-32 rounded-full bg-coral/50 transition-all duration-700 ease-out ${ringClass}`}
      />
      {/* Inner ring */}
      {active && (
        <div
          className={`absolute h-28 w-28 rounded-full border border-coral/20 transition-all duration-500 ${
            isSpeaking ? "scale-[1.15] opacity-100" : "scale-100 opacity-40"
          }`}
        />
      )}
      {/* Orb */}
      <div
        className={`relative z-10 flex h-24 w-24 items-center justify-center rounded-full ${orbBg} shadow-xl transition-all duration-500 ${
          active ? "shadow-coral/20" : "shadow-stone-900/10"
        } ${idle ? "hover:scale-105 hover:shadow-2xl" : ""}`}
      >
        {idle && (
          <svg className="h-8 w-8 text-white ml-1" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
        {connecting && (
          <div className="h-5 w-5 rounded-full border-2 border-white border-t-transparent animate-spin" />
        )}
        {active && (
          <div className="flex items-center gap-1">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`w-1 rounded-full bg-white transition-all duration-300 ${
                  isSpeaking
                    ? "animate-pulse"
                    : ""
                }`}
                style={{
                  height: isSpeaking ? `${14 + Math.sin(i * 2) * 8}px` : "8px",
                  animationDelay: `${i * 150}ms`,
                }}
              />
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

// ── Creator Canvas ──────────────────────────────────────────────────────────

function CreatorCanvas() {
  const [draft, setDraft] = useState<FormDraft>(emptyDraft);
  const [created, setCreated] = useState<{ slug: string; title: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const draftRef = useRef<FormDraft>(emptyDraft());
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const fieldCount = useMemo(() => draft.fields.length, [draft.fields]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      setTranscript((t) => [
        ...t,
        { id: `connected-${conversationId}`, role: "system", text: "Connected." },
      ]);
    },
    onDisconnect: () => {
      setTranscript((t) => [
        ...t,
        { id: `disconnected-${Date.now()}`, role: "system", text: "Session ended." },
      ]);
    },
    onError: (message) => {
      setTranscript((t) => [
        ...t,
        { id: `error-${Date.now()}`, role: "system", text: `Error: ${message}` },
      ]);
    },
    onMessage: (event) => {
      const text = event.message.trim();
      if (!text) return;
      setTranscript((t) => [
        ...t,
        {
          id: `${event.role}-${event.event_id ?? Date.now()}`,
          role: event.role,
          text,
        },
      ]);
    },
  });

  // ── Draft helpers ─────────────────────────────────────────────────────────

  function updateDraft(patch: Partial<FormDraft>) {
    const next = { ...draftRef.current, ...patch };
    draftRef.current = next;
    setDraft(next);
  }

  function updateFields(fn: (prev: FormField[]) => FormField[]) {
    const nextFields = fn(draftRef.current.fields);
    const next = { ...draftRef.current, fields: nextFields };
    draftRef.current = next;
    setDraft(next);
  }

  // ── Client tools ──────────────────────────────────────────────────────────

  const setFormTitle = (params: { title?: string; description?: string }) => {
    const title = (params.title ?? "").trim();
    if (!title) return "No title provided.";
    updateDraft({ title, description: (params.description ?? "").trim() });
    return "Done.";
  };

  const addQuestion = (params: {
    id?: string;
    label?: string;
    type?: string;
    required?: boolean;
    options?: string[];
    description?: string;
    min?: number;
    max?: number;
  }) => {
    const label = (params.label ?? "").trim();
    if (!label) return "No label provided — question not added.";

    const type: FieldType = VALID_TYPES.has(params.type ?? "") ? (params.type as FieldType) : "text";
    const id = (params.id ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")).slice(0, 32);

    const field: FormField = { id, label, type, required: params.required !== false };

    if (params.options?.length && (type === "enum" || type === "multi_select")) {
      field.options = params.options;
    }
    if (params.description) field.description = params.description;
    if (type === "scale") {
      field.validation = { min: params.min ?? 1, max: params.max ?? 10 };
    }

    updateFields((prev) => [...prev, field]);
    return `Done. ${draftRef.current.fields.length} questions so far.`;
  };

  const updateQuestion = (params: {
    index?: number;
    label?: string;
    type?: string;
    required?: boolean;
    options?: string[];
    description?: string;
  }) => {
    const idx = params.index ?? -1;
    if (idx < 0 || idx >= draftRef.current.fields.length) return "Invalid question index.";
    updateFields((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f;
        const updated = { ...f };
        if (params.label) updated.label = params.label;
        if (params.type && VALID_TYPES.has(params.type)) updated.type = params.type as FieldType;
        if (params.required !== undefined) updated.required = params.required;
        if (params.options) updated.options = params.options;
        if (params.description) updated.description = params.description;
        return updated;
      }),
    );
    return "Done.";
  };

  const removeQuestion = (params: { index?: number }) => {
    const idx = params.index ?? -1;
    if (idx < 0 || idx >= draftRef.current.fields.length) return "Invalid question index.";
    updateFields((prev) => prev.filter((_, i) => i !== idx));
    return "Done.";
  };

  const setVoiceConfig = (params: { greeting?: string; personality?: string }) => {
    const patch: Partial<FormDraft> = {};
    if (params.greeting) patch.greeting = params.greeting.trim();
    if (params.personality) patch.personality = params.personality.trim();
    updateDraft(patch);
    return "Done.";
  };

  const finalizeForm = () => {
    const d = draftRef.current;
    if (!d.title.trim()) return "Cannot finalize — no title set.";
    if (!d.fields.length) return "Cannot finalize — no questions added.";

    setSaving(true);
    createForm({
      title: d.title,
      description: d.description || undefined,
      fields: d.fields,
      greeting: d.greeting || undefined,
      personality: d.personality || undefined,
    })
      .then((form) => {
        setCreated({ slug: form.slug, title: form.title });
        conversation.endSession();
      })
      .catch((err) => {
        console.error("Failed to create form:", err);
        setTranscript((t) => [
          ...t,
          { id: `create-error-${Date.now()}`, role: "system", text: "Failed to create form. Please try again." },
        ]);
      })
      .finally(() => setSaving(false));

    return "Creating your form now...";
  };

  useConversationClientTool("set_form_title", setFormTitle);
  useConversationClientTool("add_question", addQuestion);
  useConversationClientTool("update_question", updateQuestion);
  useConversationClientTool("remove_question", removeQuestion);
  useConversationClientTool("set_voice_config", setVoiceConfig);
  useConversationClientTool("finalize_form", finalizeForm);

  // ── Start / stop ──────────────────────────────────────────────────────────

  const handleStart = async () => {
    setStarting(true);
    try {
      const signedUrl = await getSignedUrl();
      conversation.startSession({
        signedUrl,
        overrides: {
          agent: {
            prompt: { prompt: buildFormCreatorPrompt() },
            firstMessage:
              "Hey! Tell me what you need — what's this form for and who's going to fill it out?",
            language: "en" as const,
          },
        },
      });
    } finally {
      setStarting(false);
    }
  };

  const handleOrbClick = () => {
    if (conversation.status === "connected") {
      conversation.endSession();
    } else if (conversation.status === "disconnected") {
      void handleStart();
    }
  };

  // ── Success → redirect to form detail ─────────────────────────────────────

  if (created) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-coral/10">
          <svg className="h-7 w-7 text-coral" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {created.title}
        </h1>
        <p className="mt-2 text-stone-500">Your form is live.</p>
        <div className="mt-8 flex gap-3">
          <Link
            to={`/f/${created.slug}`}
            className="rounded-full bg-coral px-6 py-2.5 text-sm font-medium text-white transition hover:bg-coral-dark"
          >
            Try it
          </Link>
          <Link
            to="/dashboard"
            className="rounded-full border border-stone-200 px-6 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-50"
          >
            Dashboard
          </Link>
        </div>
      </main>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────

  const isConnected = conversation.status === "connected";
  const isIdle = conversation.status === "disconnected" && transcript.length === 0;

  return (
    <main className="flex min-h-screen flex-col bg-cream">
      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4">
        <Link
          to="/dashboard"
          className="text-sm text-stone-400 transition hover:text-stone-900"
        >
          &larr; Back
        </Link>
        {fieldCount > 0 && (
          <span className="text-xs text-stone-400">
            {fieldCount} question{fieldCount !== 1 ? "s" : ""}
            {draft.title ? ` · ${draft.title}` : ""}
          </span>
        )}
      </header>

      {/* Center content */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        {/* Pre-start state */}
        {isIdle && (
          <p className="mb-16 max-w-xs text-center text-lg leading-relaxed text-stone-400">
            Describe your form and we'll build it together.
          </p>
        )}

        {/* Orb */}
        <VoiceOrb
          status={conversation.status}
          isSpeaking={conversation.isSpeaking}
          isListening={conversation.isListening}
          onClick={handleOrbClick}
          disabled={starting || saving}
        />

        {/* Status label */}
        <p className="mt-10 text-xs uppercase tracking-[0.3em] text-stone-400">
          {saving
            ? "Creating..."
            : starting
              ? "Connecting..."
              : isConnected
                ? conversation.isSpeaking
                  ? "Speaking"
                  : "Listening"
                : isIdle
                  ? "Tap to start"
                  : "Done"}
        </p>

        {/* Transcript */}
        {transcript.length > 0 && (
          <div className="mt-10 w-full max-w-lg">
            <div className="max-h-[40vh] space-y-3 overflow-y-auto px-2">
              {transcript
                .filter((e) => e.role !== "system")
                .map((entry) => (
                  <div
                    key={entry.id}
                    className={`${
                      entry.role === "agent"
                        ? "text-stone-900"
                        : "text-stone-400"
                    }`}
                  >
                    <p className="text-sm leading-relaxed">{entry.text}</p>
                  </div>
                ))}
              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}
      </div>

      {/* Bottom — end session button when connected */}
      {isConnected && (
        <div className="flex justify-center px-6 pb-8">
          <button
            type="button"
            onClick={() => conversation.endSession()}
            className="rounded-full border border-stone-200 px-5 py-2 text-sm text-stone-500 transition hover:border-stone-400 hover:text-stone-700"
          >
            End session
          </button>
        </div>
      )}
    </main>
  );
}

// ── Page component ──────────────────────────────────────────────────────────

export function VoiceFormCreator() {
  return (
    <ConversationProvider>
      <CreatorCanvas />
    </ConversationProvider>
  );
}
