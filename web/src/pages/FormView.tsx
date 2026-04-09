import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ConversationProvider,
  useConversation,
  useConversationClientTool,
} from "@elevenlabs/react";
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

// ── Loading / Error / Not Found states ───────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
      {children}
    </main>
  );
}

function FormLoading() {
  return (
    <Shell>
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-coral border-t-transparent" />
      <p className="text-sm text-stone-500">Loading form...</p>
    </Shell>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <Shell>
      <p className="text-sm uppercase tracking-[0.3em] text-stone-400">Error</p>
      <h1 className="font-display text-4xl font-semibold tracking-tight">
        Something went wrong
      </h1>
      <p className="max-w-md text-stone-600">{message}</p>
      <Link
        to="/"
        className="rounded-full bg-coral px-6 py-3 text-sm font-medium text-white"
      >
        Back to home
      </Link>
    </Shell>
  );
}

function FormNotFound() {
  return (
    <Shell>
      <p className="text-sm uppercase tracking-[0.3em] text-stone-400">
        Not found
      </p>
      <h1 className="font-display text-5xl font-semibold tracking-tight">
        This form doesn't exist.
      </h1>
      <Link
        to="/"
        className="rounded-full bg-coral px-6 py-3 text-sm font-medium text-white"
      >
        Back to home
      </Link>
    </Shell>
  );
}

// ── Thank You screen ─────────────────────────────────────────────────────────

function ThankYou({
  form,
  answers,
}: {
  form: Form;
  answers: Record<string, string>;
}) {
  const answeredFields = form.fields.filter((f) => answers[f.id]);

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
          Complete
        </p>
        <h1 className="mt-3 font-display text-5xl font-semibold tracking-tight md:text-6xl">
          Thank you
        </h1>
        <p className="mt-4 max-w-md text-lg text-stone-600">
          Your responses have been recorded. A professional will review your
          information.
        </p>

        {answeredFields.length > 0 && (
          <div className="mt-10 w-full rounded-[1.5rem] border border-stone-900/10 bg-white/70 p-6 text-left backdrop-blur">
            <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
              Summary
            </p>
            <div className="mt-4 space-y-3">
              {answeredFields.map((field) => (
                <div key={field.id}>
                  <p className="text-xs text-stone-400">{field.label}</p>
                  <p className="mt-1 text-sm text-stone-800">
                    {answers[field.id]}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        <Link
          to="/"
          className="mt-8 rounded-full border border-stone-900/10 px-6 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-900"
        >
          Done
        </Link>
      </section>
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

  // ── Show thank you if completed ───────────────────────────────────────────

  if (completed) {
    return <ThankYou form={form} answers={answers} />;
  }

  // ── Main UI ───────────────────────────────────────────────────────────────

  return (
    <main className="relative min-h-screen overflow-hidden bg-cream text-stone-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,90,0.2),transparent_40%),linear-gradient(135deg,rgba(255,255,255,0.4),transparent_55%)]" />
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-coral/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-stone-900/8 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:grid lg:grid-cols-[1.2fr_0.8fr]">
        {/* Left column */}
        <div className="flex flex-col justify-between rounded-[2rem] border border-stone-900/10 bg-white/70 p-6 shadow-[0_24px_80px_rgba(38,24,18,0.08)] backdrop-blur xl:p-8">
          <div>
            <div className="flex items-center justify-between">
              <Link
                to="/"
                className="text-sm uppercase tracking-[0.24em] text-stone-500 transition hover:text-stone-900"
              >
                Sayso
              </Link>
              <span className="rounded-full border border-stone-900/10 px-4 py-2 text-xs uppercase tracking-[0.24em] text-stone-500">
                {formatStatus(conversation.status)}
              </span>
            </div>

            <div className="mt-10 max-w-2xl">
              <p className="text-sm uppercase tracking-[0.3em] text-coral-dark">
                Voice form
              </p>
              <h1 className="mt-3 font-display text-5xl leading-none font-semibold tracking-tight md:text-7xl">
                {form.title}
              </h1>
              {form.description && (
                <p className="mt-5 max-w-xl text-lg leading-8 text-stone-600">
                  {form.description}
                </p>
              )}
            </div>

            {/* Stats */}
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              <div className="rounded-[1.5rem] border border-stone-900/10 bg-stone-900 px-5 py-6 text-cream">
                <p className="text-xs uppercase tracking-[0.24em] text-cream/60">
                  Progress
                </p>
                <p className="mt-3 text-4xl font-semibold">{progress}%</p>
              </div>
              <div className="rounded-[1.5rem] border border-stone-900/10 bg-white px-5 py-6">
                <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
                  Captured
                </p>
                <p className="mt-3 text-4xl font-semibold">{answeredCount}</p>
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
                  submitting ||
                  conversation.status === "connecting" ||
                  conversation.status === "connected"
                }
                className="rounded-full bg-coral px-6 py-3 text-sm font-medium text-white transition hover:bg-coral-dark disabled:cursor-not-allowed disabled:opacity-50"
              >
                {starting
                  ? "Connecting..."
                  : conversation.status === "connected"
                    ? "Live now"
                    : "Start voice form"}
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
                    The voice is the form.
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

        {/* Right column — captured answers */}
        <aside className="rounded-[2rem] border border-stone-900/10 bg-stone-900 p-6 text-cream shadow-[0_24px_80px_rgba(38,24,18,0.15)] xl:p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-cream/50">
            Structured output
          </p>
          <h2 className="mt-3 font-display text-3xl">Captured answers</h2>

          <div className="mt-8 space-y-4">
            {form.fields.map((field, index) => {
              const value = answers[field.id];
              return (
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
                    <span className="rounded-full border border-white/10 px-3 py-1 text-[10px] uppercase tracking-[0.24em] text-cream/40">
                      {field.type}
                    </span>
                  </div>
                  <p className="mt-4 min-h-12 text-sm leading-7 text-cream/70">
                    {value || "Waiting for answer..."}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="mt-8 rounded-[1.5rem] border border-coral/20 bg-coral/10 p-5">
            <p className="text-xs uppercase tracking-[0.24em] text-coral-light">
              Completion
            </p>
            <p className="mt-3 text-sm leading-7 text-cream/80">
              {submitting
                ? "Saving responses..."
                : "The form will save automatically when the agent finishes all questions."}
            </p>
          </div>
        </aside>
      </section>
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
