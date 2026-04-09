import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ConversationProvider,
  useConversation,
  useConversationClientTool,
} from "@elevenlabs/react";
import { motion, AnimatePresence } from "framer-motion";
import { getSignedUrl } from "@/lib/elevenlabs";
import { fetchForm, submitResponse, FormNotFoundError } from "@/lib/api";
import { buildAgentPrompt } from "@/lib/prompt";
import type { Form } from "@/types/forms";

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
  value?: string;
  answer?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatStatus(status: string) {
  return status.replace(/^\w/, (v) => v.toUpperCase());
}

function createInitialAnswers(form: Form) {
  return Object.fromEntries(form.fields.map((f) => [f.id, ""]));
}

// ── Shared shell ─────────────────────────────────────────────────────────────

function Grain() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0 opacity-[0.04] mix-blend-multiply"
      style={{
        backgroundImage:
          "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /></filter><rect width='100%25' height='100%25' filter='url(%23n)' /></svg>\")",
      }}
    />
  );
}

function StatusShell({
  kicker,
  title,
  body,
  children,
}: {
  kicker: string;
  title: React.ReactNode;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white px-8 text-center text-black font-body">
      <Grain />
      <div className="relative flex max-w-2xl flex-col items-center gap-6">
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[11px] uppercase tracking-[0.32em] text-black/50"
        >
          {kicker}
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-6xl font-semibold leading-[0.9] tracking-tight md:text-8xl"
        >
          {title}
        </motion.h1>
        {body && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
            className="max-w-md text-base leading-7 text-black/60"
          >
            {body}
          </motion.p>
        )}
        {children}
      </div>
    </main>
  );
}

function FormLoading() {
  return (
    <StatusShell
      kicker="§ Loading"
      title={
        <>
          Tuning the <em className="italic">mic</em>…
        </>
      }
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
        className="mt-2 h-6 w-6 rounded-full border-2 border-black/20 border-t-black"
      />
    </StatusShell>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <StatusShell
      kicker="§ Error"
      title={
        <>
          Something went <em className="italic">wrong</em>.
        </>
      }
      body={message}
    >
      <Link
        to="/"
        className="mt-4 rounded-full bg-black px-7 py-4 text-sm font-medium text-white transition hover:-translate-y-0.5"
      >
        ← Back to sayso
      </Link>
    </StatusShell>
  );
}

function FormNotFound() {
  return (
    <StatusShell
      kicker="§ 404 — Not found"
      title={
        <>
          This form doesn't <em className="italic">exist</em>.
        </>
      }
    >
      <Link
        to="/"
        className="mt-4 rounded-full bg-black px-7 py-4 text-sm font-medium text-white transition hover:-translate-y-0.5"
      >
        ← Back to sayso
      </Link>
    </StatusShell>
  );
}

// ── Waveform ─────────────────────────────────────────────────────────────────

function Waveform({
  active,
  bars = 32,
  className = "",
}: {
  active: boolean;
  bars?: number;
  className?: string;
}) {
  return (
    <div className={`flex h-12 items-end gap-1 ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <motion.span
          key={i}
          className="w-1 rounded-full bg-current"
          animate={
            active ? { scaleY: [0.3, 1, 0.5, 0.9, 0.3] } : { scaleY: 0.2 }
          }
          transition={{
            duration: 1.4,
            repeat: active ? Infinity : 0,
            delay: i * 0.04,
            ease: "easeInOut",
          }}
          style={{ height: "100%", transformOrigin: "bottom" }}
        />
      ))}
    </div>
  );
}

// ── Thank you ────────────────────────────────────────────────────────────────

function ThankYou({
  form,
  answers,
}: {
  form: Form;
  answers: Record<string, string>;
}) {
  const answeredFields = form.fields.filter((f) => answers[f.id]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-black font-body">
      <Grain />

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-black/10 bg-white/80 backdrop-blur-xl">
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
          <span className="text-[10px] uppercase tracking-[0.28em] text-black/50">
            ● Complete
          </span>
          <Link
            to="/"
            className="rounded-full border border-black/20 px-5 py-2.5 text-sm font-medium text-black transition hover:border-black"
          >
            Done
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative mx-auto max-w-[1600px] px-8 pt-24 pb-16">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center gap-4"
        >
          <div className="h-px flex-1 bg-black/20" />
          <span className="text-[11px] uppercase tracking-[0.32em] text-black/60">
            § Complete · {answeredFields.length} of {form.fields.length} answered
          </span>
          <div className="h-px flex-1 bg-black/20" />
        </motion.div>

        <div className="mt-20">
          <h1 className="font-display text-[16vw] font-semibold leading-[0.85] tracking-[-0.04em] md:text-[12vw] lg:text-[11rem]">
            <div className="overflow-hidden">
              <motion.div
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
              >
                Thank
              </motion.div>
            </div>
            <div className="overflow-hidden">
              <motion.em
                initial={{ y: "110%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.35 }}
                className="block italic"
              >
                you.
              </motion.em>
            </div>
          </h1>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="mt-16 max-w-xl font-display text-2xl leading-[1.25] md:text-3xl"
        >
          Your responses have been recorded.{" "}
          <em className="italic text-black/60">
            A professional will review your information.
          </em>
        </motion.p>
      </section>

      {/* Summary */}
      {answeredFields.length > 0 && (
        <section className="relative mx-auto max-w-[1600px] px-8 pb-24">
          <div className="border-y border-black">
            <div className="flex items-center justify-between border-b border-black/10 py-6">
              <p className="text-[11px] uppercase tracking-[0.32em] text-black/50">
                § Summary
              </p>
              <p className="text-[10px] uppercase tracking-[0.28em] text-black/40">
                {form.title}
              </p>
            </div>
            <div className="divide-y divide-black/10">
              {answeredFields.map((field, i) => (
                <motion.article
                  key={field.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: 0.4 + i * 0.08,
                    duration: 0.6,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="grid gap-6 py-8 md:grid-cols-[auto_1fr_2fr] md:items-baseline md:gap-12"
                >
                  <p className="font-display text-sm text-black/40">
                    {String(i + 1).padStart(2, "0")}
                  </p>
                  <p className="font-display text-lg leading-6 text-black/60">
                    {field.label}
                  </p>
                  <p className="font-display text-xl leading-8 text-black">
                    {answers[field.id]}
                  </p>
                </motion.article>
              ))}
            </div>
          </div>
        </section>
      )}

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

// ── Voice Form Canvas ────────────────────────────────────────────────────────

function VoiceFormCanvas({ form }: { form: Form }) {
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    createInitialAnswers(form),
  );
  const [completed, setCompleted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const answersRef = useRef<Record<string, string>>(createInitialAnswers(form));
  const startTimeRef = useRef<number | null>(null);
  const slugRef = useRef(form.slug);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([
    {
      id: "system-ready",
      role: "system",
      text: "Ready to start. Press the button to begin the voice conversation.",
    },
  ]);
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const answeredCount = useMemo(
    () => Object.values(answers).filter(Boolean).length,
    [answers],
  );
  const progress = Math.round((answeredCount / form.fields.length) * 100);

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      startTimeRef.current = Date.now();
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

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // ── Client tools ──────────────────────────────────────────────────────────

  const saveAnswer = (params: SaveAnswerParams) => {
    const fieldId = params.fieldId ?? params.field ?? params.questionId;
    const value = (params.value ?? params.answer ?? "").trim();
    if (!fieldId || !value) return "No answer saved — incomplete payload.";

    const nextAnswers = {
      ...answersRef.current,
      [fieldId]: value,
    };

    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);

    return `Saved answer for ${fieldId}.`;
  };

  const completeForm = () => {
    const duration = startTimeRef.current
      ? Math.round((Date.now() - startTimeRef.current) / 1000)
      : 0;
    const answersToSubmit = answersRef.current;

    setSubmitting(true);
    submitResponse(slugRef.current, answersToSubmit, duration)
      .then(() => {
        setAnswers(answersToSubmit);
        setCompleted(true);
        conversation.endSession();
      })
      .catch((err) => {
        console.error("Failed to submit response:", err);
        setTranscript((t) => [
          ...t,
          {
            id: `submit-error-${Date.now()}`,
            role: "system",
            text: "Failed to save responses. Please try again.",
          },
        ]);
      })
      .finally(() => setSubmitting(false));

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
            firstMessage:
              form.greeting ??
              "Hi. I'll guide you through a few questions — just answer naturally.",
            language: (form.language ?? "en") as "en",
          },
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
                § 03 — Captured
              </p>
              <h2 className="mt-4 font-display text-4xl font-semibold leading-[0.95] md:text-5xl">
                Structured <em className="italic">output</em>.
              </h2>
              <p className="mt-5 max-w-md text-sm leading-7 text-white/60">
                Every answer lands in a typed schema — not a transcript. The
                agent calls client tools, we render the results live.
              </p>
            </div>

            <div className="flex-1 divide-y divide-white/10">
              {form.fields.map((field, index) => {
                const value = answers[field.id];
                const done = Boolean(value);
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
                    className="relative px-8 py-6 lg:px-10"
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
                        </div>
                        <p className="mt-3 font-display text-lg leading-6 text-white">
                          {field.label}
                        </p>
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
                          done ? "bg-white" : "bg-white/20"
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
                {submitting ? (
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
                      Saving responses…
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
                      Saves when the agent finishes
                    </span>
                    <div className="h-px flex-1 bg-white/20" />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </aside>
        </div>

        {/* Progress bar */}
        <div className="mt-8 flex items-center gap-6">
          <span className="text-[10px] uppercase tracking-[0.28em] text-black/50">
            Progress
          </span>
          <div className="h-px flex-1 bg-black/10">
            <motion.div
              className="h-full bg-black"
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
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

  if (notFound) return <FormNotFound />;
  if (error) return <FormError message={error} />;
  if (!form) return <FormLoading />;

  return (
    <ConversationProvider>
      <VoiceFormCanvas key={form.slug} form={form} />
    </ConversationProvider>
  );
}
