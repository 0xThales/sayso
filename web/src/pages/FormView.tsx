import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import {
  ConversationProvider,
  useConversation,
  useConversationClientTool,
} from "@elevenlabs/react";
import { getSignedUrl } from "@/lib/elevenlabs";
import { buildAgentPrompt, getFormById } from "@/data/forms";
import type { FormConfig } from "@/types/forms";

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

type CompleteFormParams = {
  note?: string;
};

function formatStatus(status: string) {
  return status.replace(/^\w/, (value) => value.toUpperCase());
}

function createInitialAnswers(form: FormConfig) {
  return Object.fromEntries(form.fields.map((field) => [field.id, ""]));
}

function buildFieldLabel(form: FormConfig, fieldId: string) {
  return form.fields.find((field) => field.id === fieldId)?.label ?? fieldId;
}

function VoiceFormCanvas({ form }: { form: FormConfig }) {
  const [answers, setAnswers] = useState<Record<string, string>>(() =>
    createInitialAnswers(form),
  );
  const [completedAt, setCompletedAt] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([
    {
      id: "system-ready",
      role: "system",
      text: "Mic access and your ElevenLabs agent are all this screen needs to turn the form into a conversation.",
    },
  ]);

  const answeredCount = useMemo(
    () => Object.values(answers).filter(Boolean).length,
    [answers],
  );
  const progress = Math.round((answeredCount / form.fields.length) * 100);

  const conversation = useConversation({
    onConnect: ({ conversationId }) => {
      setTranscript((current) => [
        ...current,
        {
          id: `connected-${conversationId}`,
          role: "system",
          text: "Live voice session connected.",
        },
      ]);
    },
    onDisconnect: () => {
      setTranscript((current) => [
        ...current,
        {
          id: `disconnected-${Date.now()}`,
          role: "system",
          text: "Voice session closed.",
        },
      ]);
    },
    onError: (message) => {
      setTranscript((current) => [
        ...current,
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

      setTranscript((current) => [
        ...current,
        {
          id: `${event.role}-${event.event_id ?? Date.now()}`,
          role: event.role,
          text,
        },
      ]);
    },
  });

  useEffect(() => {
    setAnswers(createInitialAnswers(form));
    setCompletedAt(null);
    setTranscript([
      {
        id: "system-ready",
        role: "system",
        text: "Mic access and your ElevenLabs agent are all this screen needs to turn the form into a conversation.",
      },
    ]);
  }, [form]);

  const saveAnswer = (params: SaveAnswerParams) => {
    const fieldId = params.fieldId ?? params.field ?? params.questionId;
    const value = (params.value ?? params.answer ?? "").trim();

    if (!fieldId || !value) {
      return "No answer was saved because the payload was incomplete.";
    }

    setAnswers((current) => ({
      ...current,
      [fieldId]: value,
    }));

    return `Saved answer for ${fieldId}.`;
  };

  const completeForm = ({ note }: CompleteFormParams = {}) => {
    const timestamp = new Date().toISOString();
    setCompletedAt(timestamp);
    setTranscript((current) => [
      ...current,
      {
        id: `complete-${timestamp}`,
        role: "system",
        text: note?.trim()
          ? `Form completed. ${note.trim()}`
          : "Form completed and ready for follow-up.",
      },
    ]);

    return "Form marked as completed.";
  };

  useConversationClientTool("save_form_answer", saveAnswer);
  useConversationClientTool("save_answer", saveAnswer);
  useConversationClientTool("save_response", saveAnswer);
  useConversationClientTool("complete_form", completeForm);
  useConversationClientTool("submit_form", completeForm);

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
              "Hi. I'll guide the form by voice, one question at a time.",
            language: "en",
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

  return (
    <main className="relative min-h-screen overflow-hidden bg-cream text-stone-900">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,90,0.2),transparent_40%),linear-gradient(135deg,rgba(255,255,255,0.4),transparent_55%)]" />
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-coral/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-stone-900/8 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-6 py-8 lg:grid lg:grid-cols-[1.2fr_0.8fr]">
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
                Voice intake demo
              </p>
              <h1 className="mt-3 font-display text-5xl leading-none font-semibold tracking-tight md:text-7xl">
                {form.title}
              </h1>
              <p className="mt-5 max-w-xl text-lg leading-8 text-stone-600">
                {form.description}
              </p>
            </div>

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

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleStart()}
                disabled={
                  starting ||
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

            <div className="mt-10 rounded-[1.75rem] border border-stone-900/10 bg-[#fffaf5] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
                    Live transcript
                  </p>
                  <p className="mt-2 text-sm text-stone-500">
                    The voice is the form. Every answer lands here and can also
                    be saved through client tools.
                  </p>
                </div>
                <div className="flex gap-2">
                  <span
                    className={`h-3 w-3 rounded-full ${
                      conversation.isListening ? "bg-coral" : "bg-stone-300"
                    }`}
                  />
                  <span
                    className={`h-3 w-3 rounded-full ${
                      conversation.isSpeaking ? "bg-stone-900" : "bg-stone-300"
                    }`}
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

        <aside className="rounded-[2rem] border border-stone-900/10 bg-stone-900 p-6 text-cream shadow-[0_24px_80px_rgba(38,24,18,0.15)] xl:p-8">
          <p className="text-xs uppercase tracking-[0.24em] text-cream/50">
            Structured output
          </p>
          <h2 className="mt-3 font-display text-3xl">Captured answers</h2>
          <p className="mt-3 text-sm leading-7 text-cream/70">
            These cards update when the agent calls the client tools. If your
            agent only talks and does not save, the transcript still lets us
            verify the flow while you wire the tool schema in ElevenLabs.
          </p>

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
                        {buildFieldLabel(form, field.id)}
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
              {completedAt
                ? `Completed at ${new Date(completedAt).toLocaleTimeString()}.`
                : "The form will mark itself complete when the agent calls the completion tool."}
            </p>
          </div>
        </aside>
      </section>
    </main>
  );
}

export function FormView() {
  const { id } = useParams<{ id: string }>();
  const form = getFormById(id);

  if (!form) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-sm uppercase tracking-[0.3em] text-stone-400">
          Unknown form
        </p>
        <h1 className="font-display text-5xl font-semibold tracking-tight">
          Nothing wired here yet.
        </h1>
        <Link
          to="/"
          className="rounded-full bg-coral px-6 py-3 text-sm font-medium text-white"
        >
          Back to landing
        </Link>
      </main>
    );
  }

  return (
    <ConversationProvider>
      <VoiceFormCanvas form={form} />
    </ConversationProvider>
  );
}
