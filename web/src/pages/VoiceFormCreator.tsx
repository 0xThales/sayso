import { useMemo, useRef, useState } from "react";
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

function formatStatus(status: string) {
  return status.replace(/^\w/, (v) => v.toUpperCase());
}

function emptyDraft(): FormDraft {
  return { title: "", description: "", fields: [], greeting: "", personality: "" };
}

const VALID_TYPES = new Set<string>([
  "text", "long_text", "number", "boolean", "enum",
  "multi_select", "email", "date", "scale", "file",
]);

// ── Success screen ──────────────────────────────────────────────────────────

function FormCreated({ slug, title }: { slug: string; title: string }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-cream text-stone-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,90,0.2),transparent_40%)]" />

      <section className="relative mx-auto flex min-h-screen max-w-2xl flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-coral/10">
          <svg
            className="h-8 w-8 text-coral"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>

        <p className="text-sm uppercase tracking-[0.3em] text-coral-dark">
          Created
        </p>
        <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight md:text-6xl">
          {title}
        </h1>
        <p className="mt-4 max-w-md text-lg text-stone-600">
          Your form is live. Share the link or fine-tune it in the editor.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            to={`/f/${slug}`}
            className="rounded-full bg-coral px-6 py-3 text-sm font-medium text-white transition hover:bg-coral-dark"
          >
            Try it out
          </Link>
          <Link
            to={`/dashboard/${slug}/edit`}
            className="rounded-full border border-stone-900/10 px-6 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-900"
          >
            Edit in editor
          </Link>
          <Link
            to="/dashboard"
            className="rounded-full border border-stone-900/10 px-6 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-900"
          >
            Dashboard
          </Link>
        </div>
      </section>
    </main>
  );
}

// ── Voice Form Creator Canvas ───────────────────────────────────────────────

function CreatorCanvas() {
  const [draft, setDraft] = useState<FormDraft>(emptyDraft);
  const [created, setCreated] = useState<{ slug: string; title: string } | null>(null);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const draftRef = useRef<FormDraft>(emptyDraft());
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([
    {
      id: "system-ready",
      role: "system",
      text: "Ready. Press the button to start designing your form by voice.",
    },
  ]);

  const fieldCount = useMemo(() => draft.fields.length, [draft.fields]);

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      setTranscript((t) => [
        ...t,
        {
          id: `connected-${conversationId}`,
          role: "system",
          text: "Voice session connected.",
        },
      ]);
    },
    onDisconnect: () => {
      setTranscript((t) => [
        ...t,
        {
          id: `disconnected-${Date.now()}`,
          role: "system",
          text: "Voice session closed.",
        },
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

  // ── Helpers to update draft ───────────────────────────────────────────────

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
    return `Form title set to "${title}".`;
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

    const field: FormField = {
      id,
      label,
      type,
      required: params.required !== false,
    };

    if (params.options?.length && (type === "enum" || type === "multi_select")) {
      field.options = params.options;
    }
    if (params.description) {
      field.description = params.description;
    }
    if (type === "scale") {
      field.validation = { min: params.min ?? 1, max: params.max ?? 10 };
    }

    updateFields((prev) => [...prev, field]);
    return `Added question ${draftRef.current.fields.length}: "${label}" (${type}).`;
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
    return `Updated question ${idx + 1}.`;
  };

  const removeQuestion = (params: { index?: number }) => {
    const idx = params.index ?? -1;
    if (idx < 0 || idx >= draftRef.current.fields.length) return "Invalid question index.";
    const removed = draftRef.current.fields[idx]!;
    updateFields((prev) => prev.filter((_, i) => i !== idx));
    return `Removed question "${removed.label}".`;
  };

  const setVoiceConfig = (params: { greeting?: string; personality?: string }) => {
    const patch: Partial<FormDraft> = {};
    if (params.greeting) patch.greeting = params.greeting.trim();
    if (params.personality) patch.personality = params.personality.trim();
    updateDraft(patch);
    return "Voice config updated.";
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
          {
            id: `create-error-${Date.now()}`,
            role: "system",
            text: "Failed to create form. Please try again.",
          },
        ]);
      })
      .finally(() => setSaving(false));

    return "Creating your form now...";
  };

  // Register all client tools
  useConversationClientTool("set_form_title", setFormTitle);
  useConversationClientTool("add_question", addQuestion);
  useConversationClientTool("update_question", updateQuestion);
  useConversationClientTool("remove_question", removeQuestion);
  useConversationClientTool("set_voice_config", setVoiceConfig);
  useConversationClientTool("finalize_form", finalizeForm);

  // ── Start session ─────────────────────────────────────────────────────────

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
              "Hey! I'm here to help you build a new form. What kind of information do you want to collect?",
            language: "en" as const,
          },
        },
      });
    } finally {
      setStarting(false);
    }
  };

  // ── Show success if created ───────────────────────────────────────────────

  if (created) {
    return <FormCreated slug={created.slug} title={created.title} />;
  }

  // ── Main UI ───────────────────────────────────────────────────────────────

  return (
    <main className="relative min-h-screen overflow-hidden bg-cream text-stone-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,90,0.2),transparent_40%),linear-gradient(135deg,rgba(255,255,255,0.4),transparent_55%)]" />
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-coral/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-stone-900/8 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:grid lg:grid-cols-[1.2fr_0.8fr]">
        {/* Left column — conversation */}
        <div className="flex flex-col justify-between rounded-[2rem] border border-stone-900/10 bg-white/70 p-6 shadow-[0_24px_80px_rgba(38,24,18,0.08)] backdrop-blur xl:p-8">
          <div>
            <div className="flex items-center justify-between">
              <Link
                to="/dashboard"
                className="text-sm uppercase tracking-[0.24em] text-stone-500 transition hover:text-stone-900"
              >
                &larr; Dashboard
              </Link>
              <span className="rounded-full border border-stone-900/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-stone-500">
                {formatStatus(conversation.status)}
              </span>
            </div>

            <div className="mt-10 max-w-2xl">
              <p className="text-sm uppercase tracking-[0.3em] text-coral-dark">
                Form designer
              </p>
              <h1 className="mt-3 font-display text-5xl leading-none font-semibold tracking-tight md:text-7xl">
                {draft.title || "Create by voice"}
              </h1>
              {draft.description && (
                <p className="mt-5 max-w-xl text-lg leading-8 text-stone-600">
                  {draft.description}
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border border-stone-900/10 bg-stone-900 px-5 py-6 text-cream">
                <p className="text-xs uppercase tracking-[0.24em] text-cream/60">
                  Questions
                </p>
                <p className="mt-3 text-4xl font-semibold">{fieldCount}</p>
              </div>
              <div className="rounded-[1.5rem] border border-stone-900/10 bg-white px-5 py-6">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
                  Title
                </p>
                <p className="mt-3 text-lg font-semibold truncate">
                  {draft.title || "..."}
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-stone-900/10 bg-white px-5 py-6">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
                  Mode
                </p>
                <p className="mt-3 text-2xl font-semibold capitalize">
                  {conversation.mode}
                </p>
              </div>
            </div>

            {/* Controls */}
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleStart()}
                disabled={
                  starting ||
                  saving ||
                  conversation.status === "connecting" ||
                  conversation.status === "connected"
                }
                className="rounded-full bg-coral px-6 py-3 text-sm font-medium text-white transition hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {starting
                  ? "Connecting..."
                  : conversation.status === "connected"
                    ? "Live now"
                    : "Start designing"}
              </button>
              <button
                type="button"
                onClick={() => void conversation.endSession()}
                disabled={conversation.status !== "connected"}
                className="rounded-full border border-stone-900/10 px-6 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                End session
              </button>
              <button
                type="button"
                onClick={() => conversation.setMuted(!conversation.isMuted)}
                className="rounded-full border border-stone-900/10 bg-white px-6 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900"
              >
                {conversation.isMuted ? "Unmute mic" : "Mute mic"}
              </button>
            </div>

            {/* Transcript */}
            <div className="mt-10 rounded-[1.75rem] border border-stone-900/10 bg-[#fffaf5] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
                    Live transcript
                  </p>
                  <p className="mt-2 text-sm text-stone-500">
                    Describe your form — the AI builds it.
                  </p>
                </div>
                <div className="flex gap-2">
                  <span
                    className={`h-3 w-3 rounded-full ${conversation.isListening ? "bg-coral" : "bg-stone-300"}`}
                  />
                  <span
                    className={`h-3 w-3 rounded-full ${conversation.isSpeaking ? "bg-stone-900" : "bg-stone-300"}`}
                  />
                </div>
              </div>

              <div className="mt-5 max-h-[22rem] space-y-3 overflow-y-auto pr-2">
                {transcript.map((entry) => (
                  <article
                    key={entry.id}
                    className={`rounded-[1.25rem] px-4 py-3 ${
                      entry.role === "agent"
                        ? "mr-8 bg-white"
                        : entry.role === "user"
                          ? "ml-8 bg-coral text-white"
                          : "border border-dashed border-stone-900/10 bg-transparent text-stone-500"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.2em] opacity-60">
                      {entry.role}
                    </p>
                    <p className="mt-2 text-sm leading-6">{entry.text}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column — form preview */}
        <aside className="rounded-[2rem] border border-stone-900/10 bg-stone-900 p-6 text-cream shadow-[0_24px_80px_rgba(38,24,18,0.15)] xl:p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-cream/50">
            Live preview
          </p>
          <h2 className="mt-3 font-display text-3xl">Form blueprint</h2>

          {/* Title preview */}
          <div className="mt-8 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-cream/40">
              Title
            </p>
            <p className="mt-2 text-lg font-semibold text-cream">
              {draft.title || "Waiting..."}
            </p>
            {draft.description && (
              <p className="mt-1 text-sm text-cream/60">{draft.description}</p>
            )}
          </div>

          {/* Questions preview */}
          <div className="mt-4 space-y-4">
            {draft.fields.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-white/10 p-5 text-center">
                <p className="text-sm text-cream/40">
                  Questions will appear here as you describe them.
                </p>
              </div>
            ) : (
              draft.fields.map((field, index) => (
                <article
                  key={field.id}
                  className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-cream/40">
                        {String(index + 1).padStart(2, "0")}
                      </p>
                      <p className="mt-2 text-base leading-6 text-cream">
                        {field.label}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {field.required && (
                        <span className="rounded-full border border-coral/30 px-2 py-0.5 text-[10px] uppercase tracking-[0.24em] text-coral-light">
                          req
                        </span>
                      )}
                      <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-cream/40">
                        {field.type}
                      </span>
                    </div>
                  </div>
                  {field.options && field.options.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {field.options.map((opt) => (
                        <span
                          key={opt}
                          className="rounded-full border border-white/10 px-2.5 py-1 text-xs text-cream/60"
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}
                  {field.type === "scale" && field.validation && (
                    <p className="mt-3 text-xs text-cream/40">
                      Scale: {field.validation.min ?? 1} – {field.validation.max ?? 10}
                    </p>
                  )}
                  {field.description && (
                    <p className="mt-2 text-xs text-cream/30 italic">
                      {field.description}
                    </p>
                  )}
                </article>
              ))
            )}
          </div>

          {/* Voice config preview */}
          {(draft.greeting || draft.personality) && (
            <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
              <p className="text-xs uppercase tracking-[0.24em] text-cream/40">
                Voice config
              </p>
              {draft.personality && (
                <p className="mt-2 text-sm text-cream/70">
                  <span className="text-cream/40">Personality:</span>{" "}
                  {draft.personality}
                </p>
              )}
              {draft.greeting && (
                <p className="mt-1 text-sm text-cream/70">
                  <span className="text-cream/40">Greeting:</span>{" "}
                  {draft.greeting}
                </p>
              )}
            </div>
          )}

          <div className="mt-8 rounded-[1.5rem] border border-coral/20 bg-coral/10 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-coral-light">
              Status
            </p>
            <p className="mt-3 text-sm leading-7 text-cream/80">
              {saving
                ? "Creating your form..."
                : fieldCount === 0
                  ? "Describe your form and the AI will structure it for you."
                  : `${fieldCount} question${fieldCount === 1 ? "" : "s"} added. Keep going or say you're done.`}
            </p>
          </div>
        </aside>
      </section>
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
