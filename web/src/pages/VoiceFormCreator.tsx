import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation } from "react-router";
import {
  ConversationProvider,
  useConversation,
  useConversationClientTool,
} from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
import { getCreatorSignedUrl } from "@/lib/elevenlabs";
import { createForm, type FieldType, type FormField } from "@/lib/api";
import { buildFormCreatorPrompt } from "@/lib/prompt";
import {
  traceSession,
  flushTracing,
  type LangfuseTrace,
} from "@/lib/langfuse";
import { DottedCanvas } from "@/components/ui/DottedCanvas";
import { VoiceOrb } from "@/components/voice/VoiceOrb";

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

// ── Creator Canvas ───────────────────────────────────────────────────────────

function CreatorCanvas({ voiceId }: { voiceId?: string }) {
  const [draft, setDraft] = useState<FormDraft>(emptyDraft);
  const [created, setCreated] = useState<{
    slug: string;
    title: string;
  } | null>(null);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);
  const isSavingRef = useRef(false);
  const draftRef = useRef<FormDraft>(emptyDraft());
  const traceRef = useRef<LangfuseTrace | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const fieldCount = useMemo(() => draft.fields.length, [draft.fields]);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      traceRef.current = traceSession({
        sessionType: "form_creation",
        conversationId,
      });
      traceRef.current?.event({ name: "session:connected", metadata: { conversationId } });
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
      traceRef.current?.update({ output: draftRef.current });
      traceRef.current?.event({ name: "session:disconnected" });
      flushTracing();
      setTranscript((t) => [
        ...t,
        {
          id: `disconnected-${Date.now()}`,
          role: "system",
          text: "Session ended.",
        },
      ]);
    },
    onError: (message, context) => {
      console.error("[sayso] Creator session error:", message, context);
      traceRef.current?.event({
        name: "session:error",
        level: "ERROR",
        metadata: { message, context },
      });
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
    onAgentToolRequest: (event) => {
      console.log("[sayso] Creator agent tool request:", event.tool_name, event);
      traceRef.current?.event({
        name: "tool:request",
        metadata: {
          toolName: event.tool_name,
          toolCallId: event.tool_call_id,
          toolType: event.tool_type,
          eventId: event.event_id,
        },
      });
      setTranscript((t) => [
        ...t,
        {
          id: `tool-request-${event.tool_call_id ?? Date.now()}`,
          role: "system",
          text: `Tool request: ${event.tool_name}`,
        },
      ]);
    },
    onAgentToolResponse: (event) => {
      console.log("[sayso] Creator agent tool response:", event.tool_name, event);
      traceRef.current?.event({
        name: "tool:response",
        metadata: {
          toolName: event.tool_name,
          toolCallId: event.tool_call_id,
          toolType: event.tool_type,
          isError: event.is_error,
          isCalled: event.is_called,
          eventId: event.event_id,
        },
      });
      setTranscript((t) => [
        ...t,
        {
          id: `tool-response-${event.tool_call_id ?? Date.now()}`,
          role: "system",
          text: `Tool response: ${event.tool_name}${event.is_error ? " (error)" : ""}`,
        },
      ]);
    },
    onUnhandledClientToolCall: (toolCall) => {
      console.error("[sayso] UNHANDLED creator tool:", toolCall.tool_name);
      traceRef.current?.event({
        name: "tool:unhandled",
        level: "ERROR",
        input: toolCall.parameters,
        metadata: { toolName: toolCall.tool_name },
      });
      setTranscript((t) => [
        ...t,
        {
          id: `unhandled-tool-${Date.now()}`,
          role: "system",
          text: `Unhandled tool: "${toolCall.tool_name}" (params: ${JSON.stringify(toolCall.parameters)})`,
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
    traceRef.current?.span({ name: "tool:set_form_title", input: params })
      .end({ output: { title: (params.title ?? "").trim() } });
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
    traceRef.current?.span({ name: "tool:add_question", input: params })
      .end({ output: field });
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
    traceRef.current?.span({ name: "tool:update_question", input: params }).end();
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
    traceRef.current?.span({ name: "tool:remove_question", input: params }).end();
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
    traceRef.current?.span({ name: "tool:set_voice_config", input: params }).end();
    const patch: Partial<FormDraft> = {};
    if (params.greeting) patch.greeting = params.greeting.trim();
    if (params.personality) patch.personality = params.personality.trim();
    updateDraft(patch);
    return "Done.";
  };

  const finalizeForm = async () => {
    const d = draftRef.current;
    if (isSavingRef.current) return "The form is already being created.";
    if (!d.title.trim()) return "Cannot finalize — no title set.";
    if (!d.fields.length) return "Cannot finalize — no questions added.";

    isSavingRef.current = true;
    setSaving(true);
    setTranscript((t) => [
      ...t,
      {
        id: `create-start-${Date.now()}`,
        role: "system",
        text: "Creating form in database...",
      },
    ]);
    try {
      const form = await createForm({
        title: d.title,
        description: d.description || undefined,
        fields: d.fields,
        voiceId: voiceId || undefined,
        greeting: d.greeting || undefined,
        personality: d.personality || undefined,
      });

      traceRef.current?.span({
        name: "api:create_form",
        input: { title: d.title, fieldCount: d.fields.length },
      }).end({ output: { slug: form.slug, id: form.id } });

      setCreated({ slug: form.slug, title: form.title });
      setTranscript((t) => [
        ...t,
        {
          id: `create-success-${Date.now()}`,
          role: "system",
          text: `Form created: ${form.slug}`,
        },
      ]);

      await conversation.endSession();
      return "Form created successfully. The conversation is ending now.";
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      traceRef.current?.event({
        name: "api:create_form:error",
        level: "ERROR",
        metadata: { error: message },
      });
      console.error("[sayso] Failed to create form:", err);
      setTranscript((t) => [
        ...t,
        {
          id: `create-error-${Date.now()}`,
          role: "system",
          text: `Failed to create form. ${message}`,
        },
      ]);
      return `Form creation failed: ${message}. Tell the user briefly, then fix what is missing before trying again.`;
    } finally {
      isSavingRef.current = false;
      setSaving(false);
    }
  };

  useConversationClientTool("set_form_title", setFormTitle);
  useConversationClientTool("add_question", addQuestion);
  useConversationClientTool("update_question", updateQuestion);
  useConversationClientTool("remove_question", removeQuestion);
  useConversationClientTool("set_voice_config", setVoiceConfig);
  useConversationClientTool("finalize_form", finalizeForm);
  useConversationClientTool("complete_form", finalizeForm);
  useConversationClientTool("submit_form", finalizeForm);

  // ── Start / stop ──────────────────────────────────────────────────────────

  const handleStart = async () => {
    setStarting(true);
    try {
      const signedUrl = await getCreatorSignedUrl();
      conversation.startSession({
        signedUrl,
        overrides: {
          agent: {
            prompt: { prompt: buildFormCreatorPrompt(voiceId) },
            firstMessage:
              "Hey! Tell me what you need — what's this form for and who's going to fill it out?",
            language: "en" as const,
          },
          ...(voiceId ? { tts: { voiceId } } : {}),
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
        className="relative z-20 flex items-center justify-between px-4 py-4 sm:px-6 md:px-8 md:py-5"
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
        <div className="text-right text-[10px] uppercase tracking-[0.28em] text-black/50 sm:min-w-[60px]">
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
      <section className="relative z-10 grid min-h-[calc(100dvh-5rem)] lg:grid-cols-[1fr_auto_1fr]">
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
        <div className="flex flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-16 md:px-8">
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

    </main>
  );
}

// ── Page component ──────────────────────────────────────────────────────────

export function VoiceFormCreator() {
  const location = useLocation();
  const voiceId = (location.state as { voiceId?: string } | null)?.voiceId;

  return (
    <ConversationProvider>
      <CreatorCanvas voiceId={voiceId} />
    </ConversationProvider>
  );
}
