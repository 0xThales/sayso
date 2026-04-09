import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import {
  ConversationProvider,
  useConversation,
  useConversationClientTool,
} from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
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
  return {
    title: "",
    description: "",
    fields: [],
    greeting: "",
    personality: "",
  };
}

const VALID_TYPES = new Set<string>([
  "text",
  "long_text",
  "number",
  "boolean",
  "enum",
  "multi_select",
  "email",
  "date",
  "scale",
  "file",
]);

// ── Background ───────────────────────────────────────────────────────────────

function DottedCanvas() {
  return (
    <>
      {/* Dots pattern */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.25]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.5) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Subtle grain */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /></filter><rect width='100%25' height='100%25' filter='url(%23n)' /></svg>\")",
        }}
      />
      {/* Radial vignette to focus attention on center */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(255,255,255,0.7) 80%, rgba(255,255,255,0.95) 100%)",
        }}
      />
    </>
  );
}

// ── Voice Orb ────────────────────────────────────────────────────────────────

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

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="relative flex items-center justify-center disabled:cursor-not-allowed"
    >
      {/* Outer radiating ring 3 */}
      <motion.div
        className="absolute h-48 w-48 rounded-full border border-black/10"
        animate={
          active
            ? { scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }
            : { scale: 1, opacity: 0 }
        }
        transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
      />
      {/* Outer radiating ring 2 */}
      <motion.div
        className="absolute h-40 w-40 rounded-full border border-black/15"
        animate={
          active
            ? { scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }
            : { scale: 1, opacity: 0 }
        }
        transition={{
          duration: 3,
          delay: 0.5,
          repeat: Infinity,
          ease: "easeOut",
        }}
      />
      {/* Outer radiating ring 1 */}
      <motion.div
        className="absolute h-32 w-32 rounded-full border border-black/20"
        animate={
          active
            ? { scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }
            : connecting
              ? { scale: [1, 1.15, 1], opacity: [0.3, 0.15, 0.3] }
              : { scale: 1, opacity: 0 }
        }
        transition={{
          duration: connecting ? 1.5 : 3,
          delay: 1,
          repeat: Infinity,
          ease: "easeOut",
        }}
      />

      {/* Speaking halo */}
      <motion.div
        className="absolute h-28 w-28 rounded-full bg-black/5"
        animate={
          isSpeaking
            ? { scale: [1, 1.15, 1] }
            : isListening
              ? { scale: [1, 1.05, 1] }
              : { scale: 1 }
        }
        transition={{
          duration: isSpeaking ? 0.8 : 1.4,
          repeat: isSpeaking || isListening ? Infinity : 0,
          ease: "easeInOut",
        }}
      />

      {/* Main orb */}
      <motion.div
        className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full bg-black shadow-[0_16px_48px_rgba(0,0,0,0.25)]"
        whileHover={idle ? { scale: 1.05 } : {}}
        whileTap={idle ? { scale: 0.96 } : {}}
        animate={
          isSpeaking
            ? { scale: [1, 1.08, 1] }
            : { scale: 1 }
        }
        transition={
          isSpeaking
            ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.3 }
        }
      >
        {idle && (
          <svg
            className="ml-1 h-8 w-8 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
        {connecting && (
          <motion.div
            className="h-5 w-5 rounded-full border-2 border-white border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        )}
        {active && (
          <div className="flex items-end gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <motion.span
                key={i}
                className="w-1 rounded-full bg-white"
                animate={
                  isSpeaking
                    ? { scaleY: [0.4, 1.2, 0.6, 1, 0.4] }
                    : isListening
                      ? { scaleY: [0.3, 0.6, 0.4, 0.5, 0.3] }
                      : { scaleY: 0.3 }
                }
                transition={{
                  duration: isSpeaking ? 0.7 : 1.4,
                  repeat: Infinity,
                  delay: i * 0.08,
                  ease: "easeInOut",
                }}
                style={{ height: "20px", transformOrigin: "bottom" }}
              />
            ))}
          </div>
        )}
      </motion.div>
    </button>
  );
}

// ── Creator Canvas ───────────────────────────────────────────────────────────

function CreatorCanvas() {
  const [draft, setDraft] = useState<FormDraft>(emptyDraft);
  const [created, setCreated] = useState<{
    slug: string;
    title: string;
  } | null>(null);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const draftRef = useRef<FormDraft>(emptyDraft());
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const fieldCount = useMemo(() => draft.fields.length, [draft.fields]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      setTranscript((t) => [
        ...t,
        {
          id: `connected-${conversationId}`,
          role: "system",
          text: "Connected.",
        },
      ]);
    },
    onDisconnect: () => {
      setTranscript((t) => [
        ...t,
        {
          id: `disconnected-${Date.now()}`,
          role: "system",
          text: "Session ended.",
        },
      ]);
    },
    onError: (message) => {
      setTranscript((t) => [
        ...t,
        {
          id: `error-${Date.now()}`,
          role: "system",
          text: `Error: ${message}`,
        },
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

    const type: FieldType = VALID_TYPES.has(params.type ?? "")
      ? (params.type as FieldType)
      : "text";
    const id = (
      params.id ??
      label
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "")
    ).slice(0, 32);

    const field: FormField = {
      id,
      label,
      type,
      required: params.required !== false,
    };

    if (params.options?.length && (type === "enum" || type === "multi_select")) {
      field.options = params.options;
    }
    if (params.description) field.description = params.description;
    if (type === "scale") {
      field.validation = { min: params.min ?? 1, max: params.max ?? 10 };
    }

    updateFields((prev) => [...prev, field]);
    return "Done.";
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
    if (idx < 0 || idx >= draftRef.current.fields.length)
      return "Invalid question index.";
    updateFields((prev) =>
      prev.map((f, i) => {
        if (i !== idx) return f;
        const updated = { ...f };
        if (params.label) updated.label = params.label;
        if (params.type && VALID_TYPES.has(params.type))
          updated.type = params.type as FieldType;
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
    if (idx < 0 || idx >= draftRef.current.fields.length)
      return "Invalid question index.";
    updateFields((prev) => prev.filter((_, i) => i !== idx));
    return "Done.";
  };

  const setVoiceConfig = (params: {
    greeting?: string;
    personality?: string;
  }) => {
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

  // ── Success screen ────────────────────────────────────────────────────────

  if (created) {
    return (
      <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white px-8 text-center text-black font-body">
        <DottedCanvas />
        <div className="relative flex max-w-3xl flex-col items-center gap-6">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-[11px] uppercase tracking-[0.32em] text-black/50"
          >
            § Form created
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="font-display text-6xl font-semibold leading-[0.9] tracking-tight md:text-8xl"
          >
            {created.title}
            <em className="italic">.</em>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="max-w-md text-base leading-7 text-black/60"
          >
            Your form is live. Share the link or try it yourself.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="mt-6 flex flex-wrap justify-center gap-3"
          >
            <Link
              to={`/f/${created.slug}`}
              className="group inline-flex items-center gap-2 rounded-full bg-black px-7 py-4 text-sm font-medium text-white transition hover:-translate-y-0.5"
            >
              Try the form
              <span className="transition group-hover:translate-x-0.5">→</span>
            </Link>
            <Link
              to="/dashboard"
              className="rounded-full border border-black/20 px-7 py-4 text-sm font-medium text-black transition hover:border-black"
            >
              Dashboard
            </Link>
          </motion.div>
        </div>
      </main>
    );
  }

  // ── Main UI ───────────────────────────────────────────────────────────────

  const isConnected = conversation.status === "connected";
  const isIdle = conversation.status === "disconnected" && transcript.length === 0;
  const agentMessages = transcript.filter((e) => e.role === "agent");
  const lastAgentMessage = agentMessages[agentMessages.length - 1];

  const statusLabel = saving
    ? "Creating"
    : starting
      ? "Connecting"
      : isConnected
        ? conversation.isSpeaking
          ? "Speaking"
          : conversation.isListening
            ? "Listening"
            : "Live"
        : isIdle
          ? "Tap to start"
          : "Done";

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-black font-body">
      <DottedCanvas />

      {/* Nav */}
      <motion.nav
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-20 flex items-center justify-between px-8 py-5"
      >
        <Link
          to="/dashboard"
          className="group flex items-center gap-2 text-sm text-black/60 transition hover:text-black"
        >
          <span className="transition group-hover:-translate-x-0.5">←</span>
          Back
        </Link>
        <div className="flex items-center gap-2.5">
          <motion.span
            className="inline-block h-2 w-2 rounded-full bg-black"
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          <span className="font-display text-2xl font-semibold tracking-tight">
            sayso
          </span>
        </div>
        <div className="min-w-[60px] text-right text-[10px] uppercase tracking-[0.28em] text-black/50">
          {fieldCount > 0 ? (
            <span>
              {String(fieldCount).padStart(2, "0")}{" "}
              question{fieldCount !== 1 ? "s" : ""}
            </span>
          ) : (
            <span className="opacity-0">—</span>
          )}
        </div>
      </motion.nav>

      {/* Main layout */}
      <section className="relative z-10 grid min-h-[calc(100vh-5rem)] lg:grid-cols-[1fr_auto_1fr]">
        {/* Left: live agent transcript */}
        <div className="hidden flex-col justify-center px-8 lg:flex">
          <AnimatePresence mode="wait">
            {lastAgentMessage ? (
              <motion.div
                key={lastAgentMessage.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="max-w-sm"
              >
                <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-black/40">
                  § The agent
                </p>
                <p className="font-display text-2xl leading-[1.2] text-black">
                  "{lastAgentMessage.text}"
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>

        {/* Center: editorial heading + orb */}
        <div className="flex flex-col items-center justify-center px-8 py-16">
          {/* Eyebrow */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="flex items-center gap-4"
          >
            <div className="h-px w-16 bg-black/20" />
            <span className="text-[11px] uppercase tracking-[0.32em] text-black/60">
              § 01 — Create a form
            </span>
            <div className="h-px w-16 bg-black/20" />
          </motion.div>

          {/* Editorial headline */}
          <div className="mt-10">
            <h1 className="text-center font-display text-6xl font-semibold leading-[0.9] tracking-[-0.03em] md:text-7xl lg:text-8xl">
              <div className="overflow-hidden">
                <motion.div
                  initial={{ y: "110%" }}
                  animate={{ y: "0%" }}
                  transition={{
                    duration: 1,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.4,
                  }}
                >
                  Describe your form.
                </motion.div>
              </div>
              <div className="overflow-hidden">
                <motion.em
                  initial={{ y: "110%", opacity: 0 }}
                  animate={{ y: "0%", opacity: 1 }}
                  transition={{
                    duration: 1,
                    ease: [0.22, 1, 0.36, 1],
                    delay: 0.55,
                  }}
                  className="block italic text-black/60"
                >
                  We'll build it together.
                </motion.em>
              </div>
            </h1>
          </div>

          {/* Orb */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mt-24"
          >
            <VoiceOrb
              status={conversation.status}
              isSpeaking={conversation.isSpeaking}
              isListening={conversation.isListening}
              onClick={handleOrbClick}
              disabled={starting || saving}
            />
          </motion.div>

          {/* Status label */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.1, duration: 0.6 }}
            className="mt-10 flex items-center gap-3 text-[11px] uppercase tracking-[0.32em] text-black/60"
          >
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                isConnected ? "bg-black" : "bg-black/30"
              }`}
            />
            {statusLabel}
          </motion.p>

          {/* End session button */}
          <AnimatePresence>
            {isConnected && (
              <motion.button
                type="button"
                onClick={() => conversation.endSession()}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="mt-10 rounded-full border border-black/20 px-6 py-3 text-sm font-medium text-black transition hover:border-black"
              >
                End session
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Right: live draft panel */}
        <div className="hidden flex-col justify-center px-8 lg:flex">
          <AnimatePresence mode="wait">
            {draft.title || draft.fields.length > 0 ? (
              <motion.div
                key="draft"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                className="max-w-sm"
              >
                <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-black/40">
                  § Draft
                </p>
                {draft.title && (
                  <motion.h2
                    key={draft.title}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="font-display text-3xl font-semibold leading-[1] tracking-tight"
                  >
                    {draft.title}
                  </motion.h2>
                )}
                {draft.fields.length > 0 && (
                  <ol className="mt-6 divide-y divide-black/10 border-y border-black/10">
                    <AnimatePresence initial={false}>
                      {draft.fields.map((field, i) => (
                        <motion.li
                          key={field.id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -10 }}
                          transition={{
                            duration: 0.5,
                            ease: [0.22, 1, 0.36, 1],
                          }}
                          className="flex items-start gap-4 py-4"
                        >
                          <span className="mt-0.5 font-display text-xs text-black/40">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <div className="flex-1">
                            <p className="font-display text-base leading-6 text-black">
                              {field.label}
                            </p>
                            <p className="mt-1 text-[9px] uppercase tracking-[0.28em] text-black/40">
                              {field.type}
                              {field.required ? " · Required" : ""}
                            </p>
                          </div>
                        </motion.li>
                      ))}
                    </AnimatePresence>
                  </ol>
                )}
                {draft.greeting && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-6"
                  >
                    <p className="text-[9px] uppercase tracking-[0.28em] text-black/40">
                      Greeting
                    </p>
                    <p className="mt-2 font-display text-sm italic leading-6 text-black/70">
                      "{draft.greeting}"
                    </p>
                  </motion.div>
                )}
              </motion.div>
            ) : isConnected ? (
              <motion.p
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="max-w-xs text-[11px] uppercase tracking-[0.28em] text-black/40"
              >
                § The draft will appear here as you describe it.
              </motion.p>
            ) : null}
          </AnimatePresence>
        </div>
      </section>

      {/* Footer */}
      <div className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between px-8 py-6 text-[10px] uppercase tracking-[0.28em] text-black/40">
        <span>Powered by ElevenLabs</span>
        <span className="hidden md:block">The voice is the form</span>
      </div>
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
