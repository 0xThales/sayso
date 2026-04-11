import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { QRCodeCanvas } from "qrcode.react";
import {
  fetchForm,
  fetchResponses,
  deleteForm,
  subscribeToResponsesStream,
  type Form,
  type FormField,
  type FormResponse,
} from "@/lib/api";

// ── CSV Export ──────────────────────────────────────────────────────────────

function escapeCSV(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function downloadCSV(form: Form, responses: FormResponse[]) {
  const fieldHeaders = form.fields.map((f) => f.label);
  const headers = [...fieldHeaders, "Date", "Duration (s)", "Completed"];

  const rows = responses.map((r) => {
    const fieldValues = form.fields.map((f) => escapeCSV(r.answers[f.id]));
    const date = new Date(r.createdAt).toISOString();
    const duration = r.duration ?? "";
    const completed = r.completed ? "Yes" : "No";
    return [...fieldValues, date, duration, completed].join(",");
  });

  const csv = [headers.map(escapeCSV).join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${form.slug}-responses.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function shortLabel(field: FormField): string {
  // Strip leading "What is your" / "Do you" / "Are you" etc. and use a compact label
  const raw = field.label
    .replace(/^(what is |what are |what's |do you |are you |have you |how |which )/i, "")
    .replace(/\?$/, "")
    .trim();
  // Capitalize first letter
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(seconds?: number | null): string | null {
  if (!seconds) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

// ── Response Card ────────────────────────────────────────────────────────────

function ResponseCard({
  response,
  fields,
  index,
}: {
  response: FormResponse;
  fields: FormField[];
  index: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const answered = fields.filter((f) => response.answers[f.id] != null && response.answers[f.id] !== "");
  const duration = formatDuration(response.duration);

  // Show first 4 answered fields in collapsed, all when expanded
  const visible = expanded ? answered : answered.slice(0, 4);
  const hasMore = answered.length > 4;

  // Find a "name" field for the card title
  const nameField = fields.find(
    (f) => f.id === "name" || f.id === "full_name" || f.type === "text",
  );
  const title = nameField ? String(response.answers[nameField.id] ?? `Response ${index}`) : `Response ${index}`;

  return (
    <div className="rounded-2xl border border-stone-200 bg-white transition hover:border-stone-300">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="font-display text-lg font-semibold tracking-tight">
              {title}
            </span>
            <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs text-stone-500">
              {answered.length}/{fields.length} answered
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs ${
                response.completed
                  ? "bg-emerald-50 text-emerald-600"
                  : "bg-amber-50 text-amber-700"
              }`}
            >
              {response.completed ? "Complete" : "Draft"}
            </span>
          </div>
          <div className="mt-0.5 flex gap-3 text-xs text-stone-400">
            <span>{formatDate(response.createdAt)}</span>
            {duration && <span>&middot; {duration}</span>}
          </div>
        </div>
        <svg
          className={`h-5 w-5 shrink-0 text-stone-400 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Answer grid */}
      <div
        className={`grid gap-x-6 gap-y-4 border-t border-stone-100 px-6 py-5 ${
          expanded ? "sm:grid-cols-2" : "sm:grid-cols-2"
        }`}
      >
        {visible.map((field) => {
          const value = response.answers[field.id];
          return (
            <div key={field.id} className="min-w-0">
              <dt className="text-xs font-medium uppercase tracking-wide text-stone-400">
                {shortLabel(field)}
              </dt>
              <dd className="mt-0.5 text-sm leading-relaxed text-stone-900">
                {String(value)}
              </dd>
            </div>
          );
        })}
      </div>

      {/* Expand toggle */}
      {hasMore && !expanded && (
        <div className="border-t border-stone-100 px-6 py-3">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs font-medium text-stone-400 transition hover:text-stone-700"
          >
            +{answered.length - 4} more answers
          </button>
        </div>
      )}
    </div>
  );
}

// ── Share Tab ───────────────────────────────────────────────────────────────

function ShareTab({
  shareUrl,
  slug,
  copied,
  setCopied,
}: {
  shareUrl: string;
  slug: string;
  copied: boolean;
  setCopied: (v: boolean) => void;
}) {
  const qrRef = useRef<HTMLDivElement>(null);

  function downloadQR() {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-qr.png`;
    a.click();
  }

  return (
    <div className="mt-8">
      <p className="text-sm text-stone-500">
        Share this link with respondents. They'll talk to a voice agent
        that walks them through your form.
      </p>
      <div className="mt-4 flex items-center gap-3">
        <code className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-3 text-sm">
          {shareUrl}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className={`rounded-full border px-4 py-2.5 text-sm transition ${
            copied
              ? "border-emerald-200 bg-emerald-50 text-emerald-600"
              : "border-stone-200 hover:bg-stone-50"
          }`}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* QR Code */}
      <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-stone-200 bg-white p-8">
        <div ref={qrRef}>
          <QRCodeCanvas
            value={shareUrl}
            size={200}
            marginSize={2}
            level="M"
          />
        </div>
        <p className="text-sm text-stone-400">
          Scan to open the form on any device
        </p>
        <button
          onClick={downloadQR}
          className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm transition hover:bg-stone-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
          </svg>
          Download QR
        </button>
      </div>

      <div className="mt-6">
        <Link
          to={`/f/${slug}`}
          target="_blank"
          className="inline-flex items-center gap-2 text-sm font-medium text-stone-700 transition hover:text-black"
        >
          Open form &rarr;
        </Link>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function FormDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"responses" | "share">("responses");
  const [copied, setCopied] = useState(false);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "offline">(
    "connecting",
  );

  useEffect(() => {
    if (!slug) return;
    Promise.all([fetchForm(slug), fetchResponses(slug)])
      .then(([f, r]) => {
        setForm(f);
        setResponses(r);
      })
      .catch(() => navigate("/dashboard"))
      .finally(() => setLoading(false));
  }, [slug, navigate]);

  useEffect(() => {
    if (!slug) return;

    let cancelled = false;
    let unsubscribe: (() => void) | null = null;

    setLiveStatus("connecting");

    subscribeToResponsesStream(slug, (event) => {
      if (cancelled) return;

      if (event.type === "connected") {
        setLiveStatus("live");
        return;
      }

      if (event.type === "response.created" || event.type === "response.updated") {
        setResponses((prev) => {
          const existingIndex = prev.findIndex(
            (response) => response.id === event.payload.response.id,
          );

          if (existingIndex === -1) {
            return [event.payload.response, ...prev];
          }

          const next = [...prev];
          next[existingIndex] = event.payload.response;
          return next;
        });
      }
    })
      .then((cleanup) => {
        if (cancelled) {
          cleanup();
          return;
        }
        unsubscribe = cleanup;
      })
      .catch((error) => {
        console.error("Failed to open live responses stream:", error);
        if (!cancelled) setLiveStatus("offline");
      });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [slug]);

  async function handleDelete() {
    if (!form || !confirm(`Delete "${form.title}"? This cannot be undone.`))
      return;
    try {
      await deleteForm(form.id);
      navigate("/dashboard");
    } catch (e: any) {
      alert(e.message);
    }
  }

  if (loading || !form) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white text-stone-400">
        Loading...
      </div>
    );
  }

  const shareUrl = `${window.location.origin}/f/${form.slug}`;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-5">
          <Link
            to="/dashboard"
            className="text-sm text-stone-500 transition hover:text-stone-900"
          >
            &larr; Back
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to={`/dashboard/${form.slug}/edit`}
              className="rounded-full border border-stone-200 px-4 py-2 text-sm transition hover:bg-stone-50"
            >
              Edit
            </Link>
            <button
              onClick={handleDelete}
              className="rounded-full border border-stone-200 px-4 py-2 text-sm text-red-500 transition hover:bg-red-50"
            >
              Delete
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {form.title}
        </h1>
        {form.description && (
          <p className="mt-2 text-stone-500">{form.description}</p>
        )}
        <div className="mt-2 text-sm text-stone-400">
          {form.fields.length} questions &middot; {responses.length} response{responses.length !== 1 ? "s" : ""}
        </div>
        <div className="mt-3 flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-stone-400">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              liveStatus === "live"
                ? "bg-emerald-500"
                : liveStatus === "connecting"
                  ? "bg-amber-400"
                  : "bg-stone-300"
            }`}
          />
          <span>
            {liveStatus === "live"
              ? "Live updates on"
              : liveStatus === "connecting"
                ? "Connecting live updates"
                : "Live updates offline"}
          </span>
        </div>

        {/* Tabs */}
        <div className="mt-8 flex gap-6 border-b border-stone-200">
          <button
            onClick={() => setTab("responses")}
            className={`pb-3 text-sm font-medium transition ${
              tab === "responses"
                ? "border-b-2 border-black text-black"
                : "text-stone-400 hover:text-stone-700"
            }`}
          >
            Responses
          </button>
          <button
            onClick={() => setTab("share")}
            className={`pb-3 text-sm font-medium transition ${
              tab === "share"
                ? "border-b-2 border-black text-black"
                : "text-stone-400 hover:text-stone-700"
            }`}
          >
            Share
          </button>
        </div>

        {/* Responses tab */}
        {tab === "responses" && (
          <div className="mt-6 space-y-4">
            {responses.length > 0 && (
              <div className="flex justify-end">
                <button
                  onClick={() => downloadCSV(form, responses)}
                  className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-4 py-2 text-sm transition hover:bg-stone-50"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
                  </svg>
                  Export CSV
                </button>
              </div>
            )}
            {responses.length === 0 ? (
              <div className="py-16 text-center text-stone-400">
                No responses yet. Share your form to start collecting answers.
              </div>
            ) : (
              responses.map((r, i) => (
                <ResponseCard
                  key={r.id}
                  response={r}
                  fields={form.fields}
                  index={responses.length - i}
                />
              ))
            )}
          </div>
        )}

        {/* Share tab */}
        {tab === "share" && (
          <ShareTab shareUrl={shareUrl} slug={form.slug} copied={copied} setCopied={setCopied} />
        )}
      </main>
    </div>
  );
}
