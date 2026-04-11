import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ConversationProvider,
  useConversation,
  useConversationClientTool,
} from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
import { getSignedUrl } from "@/lib/elevenlabs";
import {
  createResponse,
  fetchForm,
  FormNotFoundError,
  updateResponse,
  type Form,
  type FormResponse,
} from "@/lib/api";
import { buildAgentFirstMessage, buildAgentPrompt } from "@/lib/prompt";
import {
  traceSession,
  flushTracing,
  type LangfuseTrace,
} from "@/lib/langfuse";
import { Grain } from "@/components/ui/Grain";
import { Waveform } from "@/components/ui/Waveform";
import { LoadingShell, ErrorShell, NotFoundShell } from "@/components/ui/StatusShell";
import { ThankYou } from "@/components/voice/ThankYou";

// ── Types ────────────────────────────────────────────────────────────────────

type TranscriptEntry = {
  id: string;
  role: "agent" | "user" | "system";
  text: string;
};

type SaveAnswerParams = {
  fieldId?: string;
  field?: string;
  questionId?: string;
  value?: unknown;
  answer?: unknown;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatStatus(status: string) {
  return status.replace(/^\w/, (v) => v.toUpperCase());
}

function createInitialAnswers(form: Form) {
  return Object.fromEntries(form.fields.map((f) => [f.id, ""]));
}

function normalizeAnswerValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeAnswerValue(item))
      .filter(Boolean)
      .join(", ");
  }
  return String(value).trim();
}

function normalizeFieldKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\s_-]+/g, " ")
    .replace(/[^\w\s]/g, "");
}

function resolveFieldId(form: Form, params: SaveAnswerParams): string | null {
  const rawFieldKey = [params.fieldId, params.field, params.questionId].find(
    (value): value is string => typeof value === "string" && value.trim().length > 0,
  );

  if (!rawFieldKey) return null;

  const directMatch = form.fields.find((field) => field.id === rawFieldKey.trim());
  if (directMatch) return directMatch.id;

  if (/^\d+$/.test(rawFieldKey.trim())) {
    const position = Number(rawFieldKey.trim()) - 1;
    return form.fields[position]?.id ?? null;
  }

  const normalized = normalizeFieldKey(rawFieldKey);
  const fuzzyMatch = form.fields.find(
    (field) =>
      normalizeFieldKey(field.id) === normalized ||
      normalizeFieldKey(field.label) === normalized,
  );

  return fuzzyMatch?.id ?? null;
}

// ── Shared UI imported from components/ ─────────────────────────────────────

// ── Voice Form Canvas ────────────────────────────────────────────────────────

function VoiceFormCanvas({ form }: { form: Form }) {
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    createInitialAnswers(form),
  );
  const [completed, setCompleted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const answersRef = useRef<Record<string, string>>(createInitialAnswers(form));
  const startTimeRef = useRef<number | null>(null);
  const slugRef = useRef(form.slug);
  const responseIdRef = useRef<string | null>(null);
  const saveChainRef = useRef<Promise<FormResponse | null>>(Promise.resolve(null));
  const isSubmittingRef = useRef(false);
  const isCompletedRef = useRef(false);
  const conversationIdRef = useRef<string | null>(null);
  const traceRef = useRef<LangfuseTrace | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([
    {
      id: "system-ready",
      role: "system",
      text: "Ready to start. Press the button to begin the voice conversation.",
    },
  ]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const totalQuestions = form.fields.length;
  const answeredCount = useMemo(
    () => Object.values(answers).filter(Boolean).length,
    [answers],
  );
  const progress =
    totalQuestions === 0 ? 100 : Math.round((answeredCount / totalQuestions) * 100);
  const firstIncompleteIndex = form.fields.findIndex(
    (field) => !answers[field.id]?.trim(),
  );
  const currentQuestionIndex =
    firstIncompleteIndex === -1 ? Math.max(totalQuestions - 1, 0) : firstIncompleteIndex;
  const currentField = totalQuestions > 0 ? form.fields[currentQuestionIndex] : null;
  const remainingCount = Math.max(totalQuestions - answeredCount, 0);

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      startTimeRef.current = Date.now();
      conversationIdRef.current = conversationId;
      traceRef.current = traceSession({
        sessionType: "form_response",
        conversationId,
        formSlug: form.slug,
        formTitle: form.title,
        formId: form.id,
      });
      traceRef.current?.event({ name: "session:connected", metadata: { conversationId } });
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
      traceRef.current?.update({ output: answersRef.current });
      traceRef.current?.event({ name: "session:disconnected" });
      flushTracing();
      setTranscript((t) => [
        ...t,
        {
          id: `disconnected-${Date.now()}`,
          role: "system",
          text: "Voice session closed.",
        },
      ]);
    },
    onError: (message, context) => {
      console.error("[sayso] Session error:", message, context);
      traceRef.current?.event({
        name: "session:error",
        level: "ERROR",
        metadata: { message, context },
      });
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
    onUnhandledClientToolCall: (toolCall) => {
      console.error("[sayso] UNHANDLED tool call:", toolCall.tool_name);
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

  useEffect(() => {
    if (transcript.length <= 1) return;
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  const getDurationSeconds = () => {
    if (!startTimeRef.current) return 0;
    return Math.max(0, Math.round((Date.now() - startTimeRef.current) / 1000));
  };

  const queueResponseSave = (
    nextAnswers: Record<string, string>,
    options?: { completed?: boolean },
  ) => {
    const answersSnapshot = { ...nextAnswers };
    const completedFlag = options?.completed ?? false;

    setSaveState("saving");

    const queuedSave = saveChainRef.current
      .catch(() => null)
      .then(async () => {
        const isUpdate = !!responseIdRef.current;
        const spanName = isUpdate ? "api:update_response" : "api:create_response";
        const span = traceRef.current?.span({
          name: spanName,
          input: {
            slug: slugRef.current,
            responseId: responseIdRef.current,
            answers: answersSnapshot,
            completed: completedFlag,
          },
        });

        try {
          const response = responseIdRef.current
            ? await updateResponse(
                slugRef.current,
                responseIdRef.current,
                answersSnapshot,
                {
                  completed: completedFlag,
                  duration: getDurationSeconds(),
                },
              )
            : await createResponse(slugRef.current, answersSnapshot, {
                completed: completedFlag,
                duration: getDurationSeconds(),
                conversationId: conversationIdRef.current ?? undefined,
              });

          responseIdRef.current = response.id;
          span?.end({ output: { id: response.id, completed: response.completed } });
          return response;
        } catch (error) {
          span?.end({
            output: error instanceof Error ? error.message : String(error),
            level: "ERROR",
          });
          throw error;
        }
      });

    saveChainRef.current = queuedSave;

    return queuedSave
      .then((response) => {
        setSaveState("saved");
        setLastSavedAt(Date.now());
        return response;
      })
      .catch((error) => {
        console.error("Failed to persist form response:", error);
        setSaveState("error");
        throw error;
      });
  };

  // ── Client tools ──────────────────────────────────────────────────────────

  const saveAnswer = (params: SaveAnswerParams) => {
    const resolvedFieldId = resolveFieldId(form, params);
    const value = normalizeAnswerValue(params.value ?? params.answer);
    const fieldId = resolvedFieldId ?? currentField?.id ?? null;

    const resolution = {
      resolvedFieldId,
      fallbackFieldId: currentField?.id ?? null,
      finalFieldId: fieldId,
      normalizedValue: value,
      formFieldIds: form.fields.map((f) => f.id),
    };

    if (!fieldId || !value) {
      traceRef.current?.event({
        name: "tool:save_answer:rejected",
        level: "WARNING",
        input: params,
        output: "No answer saved — incomplete payload.",
        metadata: resolution,
      });
      return "No answer saved — incomplete payload.";
    }

    if (!resolvedFieldId && currentField) {
      traceRef.current?.event({
        name: "tool:save_answer:fallback",
        level: "WARNING",
        input: params,
        metadata: { ...resolution, reason: "Used currentField as fallback" },
      });
    }

    const nextAnswers = {
      ...answersRef.current,
      [fieldId]: value,
    };

    traceRef.current?.span({
      name: "tool:save_answer",
      input: params,
      metadata: resolution,
    }).end({ output: { fieldId, value } });

    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
    void queueResponseSave(nextAnswers).catch(() => {
      setTranscript((t) => [
        ...t,
        {
          id: `draft-save-error-${Date.now()}`,
          role: "system",
          text: "Failed to save this answer to the database. The form will keep trying when more answers arrive.",
        },
      ]);
    });

    return `Saved answer for ${fieldId}.`;
  };

  const finishSuccessfulSubmission = () => {
    const minSuccessDelayMs = 1200;
    const maxWaitMs = 4000;
    const startedAt = Date.now();

    const tick = () => {
      const elapsed = Date.now() - startedAt;
      const waitedLongEnough = elapsed >= minSuccessDelayMs;
      const timedOut = elapsed >= maxWaitMs;

      if ((waitedLongEnough && !conversation.isSpeaking) || timedOut) {
        conversation.endSession();
        setCompleted(true);
        return;
      }

      window.setTimeout(tick, 150);
    };

    window.setTimeout(tick, 150);
  };

  const completeForm = () => {
    if (isCompletedRef.current) {
      return "The form is already complete.";
    }

    if (isSubmittingRef.current) {
      return "Responses are already being saved.";
    }

    const missingRequired = form.fields.filter(
      (field) => field.required && !answersRef.current[field.id]?.trim(),
    );

    if (missingRequired.length > 0) {
      const nextField = missingRequired[0]!;
      traceRef.current?.event({
        name: "tool:complete_form:rejected",
        level: "WARNING",
        input: { currentAnswers: answersRef.current },
        metadata: { missingFields: missingRequired.map((f) => f.id) },
      });
      return `The form is not complete yet. Ask the user for the required field "${nextField.label}" (field id: ${nextField.id}).`;
    }

    const answersToSubmit = answersRef.current;

    traceRef.current?.span({
      name: "tool:complete_form",
      input: { answers: answersToSubmit, fieldCount: form.fields.length },
    }).end();

    isSubmittingRef.current = true;
    setSubmitting(true);
    queueResponseSave(answersToSubmit, { completed: true })
      .then(() => {
        setAnswers(answersToSubmit);
        isCompletedRef.current = true;
        setTranscript((t) => [
          ...t,
          {
            id: `submit-success-${Date.now()}`,
            role: "system",
            text: "Responses saved successfully.",
          },
        ]);
        finishSuccessfulSubmission();
      })
      .catch((err) => {
        console.error("Failed to finalize response:", err);
        setTranscript((t) => [
          ...t,
          {
            id: `submit-error-${Date.now()}`,
            role: "system",
            text: "Failed to save responses. Please try again.",
          },
        ]);
      })
      .finally(() => {
        isSubmittingRef.current = false;
        setSubmitting(false);
      });

    return "Form completed. Saving responses...";
  };

  useConversationClientTool("save_form_answer", saveAnswer);
  useConversationClientTool("save_answer", saveAnswer);
  useConversationClientTool("save_response", saveAnswer);
  useConversationClientTool("complete_form", completeForm);
  useConversationClientTool("submit_form", completeForm);

  // ── Start session ─────────────────────────────────────────────────────────

  const handleStart = async () => {
    setStarting(true);
    try {
      const signedUrl = await getSignedUrl();
      conversation.startSession({
        signedUrl,
        overrides: {
          agent: {
            prompt: { prompt: buildAgentPrompt(form) },
            firstMessage: buildAgentFirstMessage(form),
            language: "en" as const,
          },
          ...(form.voiceId ? { tts: { voiceId: form.voiceId } } : {}),
        },
        dynamicVariables: {
          form_id: form.id,
          form_title: form.title,
          field_count: form.fields.length,
        },
      });
    } finally {
      setStarting(false);
    }
  };

  if (completed) {
    return <ThankYou form={form} answers={answers} />;
  }

  const isConnected = conversation.status === "connected";
  const isConnecting = starting || conversation.status === "connecting";
  const titleWords = form.title.split(" ");
  const headTitle =
    titleWords.length > 1
      ? titleWords.slice(0, -1).join(" ")
      : form.title;
  const headTail = titleWords.length > 1 ? titleWords[titleWords.length - 1] : "";
  const currentQuestionNumber = totalQuestions === 0 ? 0 : currentQuestionIndex + 1;
  const lastSavedLabel = lastSavedAt
    ? new Date(lastSavedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  const saveStateLabel = submitting
    ? "Finalizing response"
    : saveState === "saving"
      ? "Saving latest answer"
      : saveState === "saved"
        ? lastSavedLabel
          ? `Saved to database at ${lastSavedLabel}`
          : "Saved to database"
        : saveState === "error"
          ? "Database sync needs attention"
          : "Waiting for first answer";

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-black font-body">
      <Grain />

      {/* Nav */}
      <motion.nav
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="sticky top-0 z-50 border-b border-black/10 bg-white/80 backdrop-blur-xl"
      >
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-8 py-5">
          <Link to="/" className="flex items-center gap-2.5">
            <motion.span
              className="inline-block h-2 w-2 rounded-full bg-black"
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            <span className="font-display text-2xl font-semibold tracking-tight">
              sayso
            </span>
          </Link>
          <div className="hidden items-center gap-6 text-[10px] uppercase tracking-[0.28em] text-black/60 md:flex">
            <span>Form · {form.slug}</span>
            <span className="h-3 w-px bg-black/20" />
            <span className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  isConnected ? "bg-black" : "bg-black/30"
                }`}
              />
              {formatStatus(conversation.status)}
            </span>
          </div>
          <Link
            to="/"
            className="rounded-full border border-black/20 px-5 py-2.5 text-sm font-medium text-black transition hover:border-black"
          >
            ← Back
          </Link>
        </div>
      </motion.nav>

      {/* Editorial header */}
      <section className="relative mx-auto max-w-[1600px] px-8 pt-20 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="flex items-center gap-4"
        >
          <div className="h-px flex-1 bg-black/20" />
          <span className="text-[11px] uppercase tracking-[0.32em] text-black/60">
            § Voice intake · {form.fields.length} questions · Est. MMXXVI
          </span>
          <div className="h-px flex-1 bg-black/20" />
        </motion.div>

        <div className="mt-16">
          <h1 className="font-display text-[14vw] font-semibold leading-[0.85] tracking-[-0.04em] text-black md:text-[11vw] lg:text-[9rem]">
            <div className="overflow-hidden">
              <motion.div
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
              >
                {headTitle}
              </motion.div>
            </div>
            {headTail && (
              <div className="overflow-hidden">
                <motion.em
                  initial={{ y: "110%", opacity: 0 }}
                  animate={{ y: "0%", opacity: 1 }}
                  transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.45 }}
                  className="block italic"
                >
                  {headTail}.
                </motion.em>
              </div>
            )}
          </h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="mt-12 grid gap-10 md:grid-cols-[1fr_1.3fr_auto] md:items-end"
        >
          <p className="max-w-xs text-[11px] uppercase tracking-[0.28em] text-black/50">
            § No typing. No fields. Just a conversation — you speak, Sayso
            listens, the answers arrive structured.
          </p>
          <p className="max-w-xl font-display text-2xl leading-[1.25] text-black md:text-3xl">
            {form.description || "A voice-first intake powered by ElevenLabs."}
          </p>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.28em] text-black/40">
              Completion
            </p>
            <motion.p
              key={progress}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1 font-display text-5xl font-semibold leading-none"
            >
              {progress}
              <span className="text-2xl text-black/40">%</span>
            </motion.p>
            <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-black/45">
              {answeredCount} answered · {remainingCount} left
            </p>
          </div>
        </motion.div>
      </section>

      {/* Main grid */}
      <section className="relative mx-auto max-w-[1600px] px-8 pb-24">
        <div className="grid gap-px border-y border-black bg-black lg:grid-cols-[1.3fr_1fr]">
          {/* Left: Control + Transcript */}
          <div className="flex flex-col bg-white">
            <div className="border-b border-black/10 p-8 lg:p-12">
              <div className="flex items-start justify-between gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.32em] text-black/50">
                    § 01 — The session
                  </p>
                  <h2 className="mt-4 font-display text-4xl font-semibold leading-[0.95] md:text-5xl">
                    {isConnected ? (
                      <>
                        Live. <em className="italic">Just talk.</em>
                      </>
                    ) : submitting ? (
                      <>
                        Saving<em className="italic">…</em>
                      </>
                    ) : isConnecting ? (
                      <>
                        Connecting<em className="italic">…</em>
                      </>
                    ) : (
                      <>
                        Ready when <em className="italic">you</em> are.
                      </>
                    )}
                  </h2>
                </div>
                <div className="hidden flex-col items-end gap-2 md:flex">
                  <span className="text-[10px] uppercase tracking-[0.28em] text-black/40">
                    Mode
                  </span>
                  <span className="font-display text-lg capitalize">
                    {conversation.mode || "idle"}
                  </span>
                </div>
              </div>

              <div className="mt-10 grid gap-px overflow-hidden border border-black/10 bg-black md:grid-cols-[1.2fr_0.8fr]">
                <div className="bg-white p-6">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-black/45">
                      Current question
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-black/35">
                      {currentQuestionNumber}/{totalQuestions}
                    </p>
                  </div>
                  <p className="mt-4 font-display text-2xl leading-tight text-black">
                    {currentField ? currentField.label : "All questions answered."}
                  </p>
                  <div className="mt-6 h-2 overflow-hidden rounded-full bg-black/10">
                    <motion.div
                      className="h-full bg-emerald-500"
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                    />
                  </div>
                  <p className="mt-3 text-[10px] uppercase tracking-[0.28em] text-black/45">
                    {answeredCount} complete · {remainingCount} remaining
                  </p>
                </div>
                <div className="bg-[#f3efe6] p-6 text-black">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-black/45">
                    Database sync
                  </p>
                  <p className="mt-4 font-display text-2xl leading-tight">
                    {saveState === "error"
                      ? "Needs retry."
                      : saveState === "saved"
                        ? "Draft saved."
                        : saveState === "saving" || submitting
                          ? "Saving live."
                          : "Standing by."}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-black/60">
                    {saveStateLabel}
                  </p>
                </div>
              </div>

              {/* Waveform bar */}
              <div className="mt-10 flex items-center gap-6 border-y border-black/10 py-8">
                <div className="flex items-center gap-3">
                  <motion.span
                    className={`h-2 w-2 rounded-full ${
                      conversation.isListening ? "bg-black" : "bg-black/20"
                    }`}
                    animate={
                      conversation.isListening ? { scale: [1, 1.6, 1] } : {}
                    }
                    transition={{ duration: 1.2, repeat: Infinity }}
                  />
                  <span className="text-[10px] uppercase tracking-[0.28em] text-black/50">
                    {conversation.isListening
                      ? "Listening"
                      : conversation.isSpeaking
                        ? "Speaking"
                        : isConnected
                          ? "Idle"
                          : "Offline"}
                  </span>
                </div>
                <Waveform
                  active={conversation.isListening || conversation.isSpeaking}
                  bars={48}
                  className="h-12 flex-1 text-black"
                />
                <span className="text-[10px] uppercase tracking-[0.28em] text-black/40">
                  {answeredCount}/{form.fields.length}
                </span>
              </div>

              {/* Buttons */}
              <div className="mt-10 flex flex-wrap items-center gap-3">
                <motion.button
                  type="button"
                  onClick={() => void handleStart()}
                  disabled={isConnecting || isConnected || submitting}
                  whileHover={
                    !isConnecting && !isConnected && !submitting
                      ? { y: -2 }
                      : {}
                  }
                  whileTap={{ scale: 0.98 }}
                  className="group inline-flex items-center gap-3 rounded-full bg-black px-8 py-4 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <span className="relative flex h-2 w-2">
                    {isConnected && (
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                    )}
                    <span
                      className={`relative inline-flex h-2 w-2 rounded-full ${
                        isConnected ? "bg-white" : "bg-white/60"
                      }`}
                    />
                  </span>
                  {isConnecting
                    ? "Connecting…"
                    : isConnected
                      ? "Live now"
                      : submitting
                        ? "Saving…"
                        : "Start voice form"}
                  <span className="transition group-hover:translate-x-0.5">
                    →
                  </span>
                </motion.button>
                <button
                  type="button"
                  onClick={() => void conversation.endSession()}
                  disabled={!isConnected}
                  className="rounded-full border border-black/20 px-6 py-4 text-sm font-medium text-black transition hover:border-black disabled:cursor-not-allowed disabled:opacity-40"
                >
                  End session
                </button>
                <button
                  type="button"
                  onClick={() => conversation.setMuted(!conversation.isMuted)}
                  className="rounded-full border border-black/20 px-6 py-4 text-sm font-medium text-black transition hover:border-black"
                >
                  {conversation.isMuted ? "Unmute mic" : "Mute mic"}
                </button>
              </div>
            </div>

            {/* Transcript */}
            <div className="flex flex-1 flex-col p-8 lg:p-12">
              <div className="flex items-center justify-between">
                <p className="text-[10px] uppercase tracking-[0.32em] text-black/50">
                  § 02 — Live transcript
                </p>
                <p className="text-[10px] uppercase tracking-[0.28em] text-black/40">
                  {transcript.length} entries
                </p>
              </div>

              <div className="mt-6 max-h-[32rem] space-y-4 overflow-y-auto pr-2">
                <AnimatePresence initial={false}>
                  {transcript.map((entry) => (
                    <motion.article
                      key={entry.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                      className={
                        entry.role === "agent"
                          ? "max-w-xl"
                          : entry.role === "user"
                            ? "ml-auto max-w-xl"
                            : "max-w-full"
                      }
                    >
                      {entry.role === "system" ? (
                        <div className="flex items-center gap-3 border-l-2 border-black/30 py-1 pl-4">
                          <span className="text-[9px] uppercase tracking-[0.28em] text-black/40">
                            System
                          </span>
                          <p className="text-sm italic text-black/50">
                            {entry.text}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p
                            className={`mb-2 text-[9px] uppercase tracking-[0.28em] ${
                              entry.role === "user"
                                ? "text-right text-black/60"
                                : "text-black/50"
                            }`}
                          >
                            {entry.role === "agent" ? "Agent" : "You"}
                          </p>
                          <div
                            className={
                              entry.role === "agent"
                                ? "rounded-2xl rounded-tl-sm border border-black/10 bg-white px-5 py-4 shadow-[4px_4px_0_0_rgba(0,0,0,1)]"
                                : "rounded-2xl rounded-tr-sm bg-black px-5 py-4 text-white"
                            }
                          >
                            <p
                              className={`leading-7 ${
                                entry.role === "agent"
                                  ? "font-display text-lg text-black"
                                  : "text-base"
                              }`}
                            >
                              {entry.text}
                            </p>
                          </div>
                        </div>
                      )}
                    </motion.article>
                  ))}
                </AnimatePresence>
                <div ref={transcriptEndRef} />
              </div>
            </div>
          </div>

          {/* Right: Captured answers */}
          <aside className="flex flex-col bg-black text-white">
            <div className="border-b border-white/10 p-8 lg:p-10">
              <p className="text-[10px] uppercase tracking-[0.32em] text-white/50">
                § 03 — Progress
              </p>
              <h2 className="mt-4 font-display text-4xl font-semibold leading-[0.95] md:text-5xl">
                Question by <em className="italic">question</em>.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-white/60">
                Each answer is captured live, marked against its question, and
                saved to the database as the conversation moves forward.
              </p>
              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">
                    Form progress
                  </p>
                  <p className="mt-3 font-display text-4xl leading-none">
                    <span className="text-emerald-300">{progress}</span>
                    <span className="text-xl text-emerald-300/55">%</span>
                  </p>
                  <p className="mt-3 text-sm text-white/60">
                    {answeredCount} of {totalQuestions} questions complete
                  </p>
                </div>
                <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-white/45">
                    Current focus
                  </p>
                  <p className="mt-3 font-display text-2xl leading-tight text-white">
                    {currentField ? `Q${currentQuestionNumber}` : "Done"}
                  </p>
                  <p className="mt-3 text-sm leading-6 text-white/60">
                    {currentField ? currentField.label : "Every question has an answer."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 divide-y divide-white/10">
              {form.fields.map((field, index) => {
                const value = answers[field.id];
                const done = Boolean(value);
                const isCurrent = !done && index === currentQuestionIndex;
                const statusLabel = done
                  ? "Complete"
                  : isCurrent
                    ? isConnected
                      ? "In progress"
                      : "Next up"
                    : index < currentQuestionIndex
                      ? "Skipped"
                      : "Queued";
                const questionProgress = done ? 100 : isCurrent ? 48 : 0;
                return (
                  <motion.article
                    key={field.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      duration: 0.6,
                      delay: 0.5 + index * 0.06,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className={`relative px-8 py-6 lg:px-10 ${
                      isCurrent ? "bg-white/[0.03]" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <p className="font-display text-xs text-white/40">
                            {String(index + 1).padStart(2, "0")}
                          </p>
                          <span className="text-[9px] uppercase tracking-[0.28em] text-white/40">
                            {field.type}
                          </span>
                          {field.required && (
                            <span className="text-[9px] uppercase tracking-[0.28em] text-white/40">
                              · Required
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2 py-1 text-[9px] uppercase tracking-[0.28em] ${
                              done
                                ? "bg-emerald-300 text-black"
                                : isCurrent
                                  ? "bg-emerald-300/15 text-emerald-200"
                                  : "bg-white/5 text-white/45"
                            }`}
                          >
                            {statusLabel}
                          </span>
                        </div>
                        <p className="mt-3 font-display text-lg leading-6 text-white">
                          {field.label}
                        </p>
                        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
                          <motion.div
                            className={`h-full ${
                              done
                                ? "bg-emerald-300"
                                : isCurrent
                                  ? "bg-emerald-400"
                                  : "bg-white/20"
                            }`}
                            animate={{ width: `${questionProgress}%` }}
                            transition={{ duration: 0.45, ease: "easeOut" }}
                          />
                        </div>
                        <AnimatePresence mode="wait">
                          <motion.p
                            key={value || "empty"}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -6 }}
                            className={`mt-4 min-h-6 text-sm leading-7 ${
                              done ? "text-white/80" : "italic text-white/30"
                            }`}
                          >
                            {value || "Waiting for answer…"}
                          </motion.p>
                        </AnimatePresence>
                      </div>
                      <motion.span
                        animate={done ? { scale: [1, 1.4, 1] } : {}}
                        transition={{ duration: 0.5 }}
                        className={`mt-2 inline-block h-2 w-2 flex-shrink-0 rounded-full ${
                          done
                            ? "bg-emerald-300"
                            : isCurrent
                              ? "bg-emerald-400"
                              : "bg-white/20"
                        }`}
                      />
                    </div>
                  </motion.article>
                );
              })}
            </div>

            {/* Completion banner */}
            <div className="border-t border-white/10 p-8 lg:p-10">
              <AnimatePresence mode="wait">
                {submitting || saveState === "saving" ? (
                  <motion.div
                    key="saving"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-4"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{
                        duration: 1.2,
                        repeat: Infinity,
                        ease: "linear",
                      }}
                      className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white"
                    />
                    <span className="text-[10px] uppercase tracking-[0.28em] text-white/60">
                      {submitting
                        ? "Finalizing response…"
                        : "Saving latest answer…"}
                    </span>
                  </motion.div>
                ) : saveState === "saved" ? (
                  <motion.div
                    key="saved"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-4"
                  >
                    <div className="h-2 w-2 rounded-full bg-emerald-300" />
                    <span className="text-[10px] uppercase tracking-[0.28em] text-white/60">
                      Draft saved to database
                    </span>
                  </motion.div>
                ) : saveState === "error" ? (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-4"
                  >
                    <div className="h-2 w-2 rounded-full bg-[#f1d7a8]" />
                    <span className="text-[10px] uppercase tracking-[0.28em] text-white/60">
                      Save failed. Keep the session open and try again.
                    </span>
                  </motion.div>
                ) : (
                  <motion.div
                    key="waiting"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-4"
                  >
                    <div className="h-px flex-1 bg-white/20" />
                    <span className="text-[10px] uppercase tracking-[0.28em] text-white/40">
                      Waiting for the first captured answer
                    </span>
                    <div className="h-px flex-1 bg-white/20" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </aside>
        </div>

        {/* Progress bar */}
        <div className="mt-8 grid gap-4 border border-black/10 px-6 py-5 md:grid-cols-[auto_1fr_auto] md:items-center">
          <span className="text-[10px] uppercase tracking-[0.28em] text-black/50">
            Form progress
          </span>
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-black/10">
              <motion.div
                className="h-full bg-emerald-500"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
            <p className="mt-3 text-sm text-black/55">
              {currentField
                ? `Question ${currentQuestionNumber} is the current step.`
                : "All questions have been captured."}
            </p>
          </div>
          <span className="font-display text-sm text-black/60">
            {answeredCount} of {form.fields.length}
          </span>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-black/10">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-8 py-8">
          <p className="text-[10px] uppercase tracking-[0.28em] text-black/40">
            Powered by ElevenLabs · The voice is the form
          </p>
          <Link
            to="/"
            className="text-[10px] uppercase tracking-[0.28em] text-black/60 transition hover:text-black"
          >
            ← sayso
          </Link>
        </div>
      </footer>
    </main>
  );
}

// ── Page component ───────────────────────────────────────────────────────────

export function FormView() {
  const { slug } = useParams<{ slug: string }>();
  const [form, setForm] = useState<Form | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;

    setForm(null);
    setError(null);
    setNotFound(false);

    fetchForm(slug)
      .then((nextForm) => {
        if (cancelled) return;
        setForm(nextForm);
      })
      .catch((err) => {
        if (cancelled) return;

        if (err instanceof FormNotFoundError) {
          setNotFound(true);
        } else {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (notFound) return <NotFoundShell />;
  if (error) return <ErrorShell message={error} />;
  if (!form) return <LoadingShell />;

  return (
    <ConversationProvider>
      <VoiceFormCanvas key={form.slug} form={form} />
    </ConversationProvider>
  );
}
