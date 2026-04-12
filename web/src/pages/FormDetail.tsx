import { useEffect, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { LoadingShell } from "@/components/ui/StatusShell";
import { QRCodeCanvas } from "qrcode.react";
import {
  deleteForm,
  fetchForm,
  fetchInvites,
  fetchResponses,
  sendInvites,
  subscribeToResponsesStream,
  type Form,
  type FormField,
  type FormInvite,
  type FormResponse,
} from "@/lib/api";
import { downloadCSV } from "@/lib/csv";

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

function parseInviteEmails(input: string) {
  const matches = input.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return Array.from(new Set(matches.map((email) => email.toLowerCase())));
}

function formatInviteStatus(status: FormInvite["status"]) {
  return status.replace(/^\w/, (letter) => letter.toUpperCase());
}

function inviteStatusClasses(status: FormInvite["status"]) {
  switch (status) {
    case "completed":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "opened":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "sent":
      return "bg-stone-100 text-stone-700 border-stone-200";
    case "failed":
      return "bg-red-50 text-red-600 border-red-200";
    default:
      return "bg-amber-50 text-amber-700 border-amber-200";
  }
}

function buildInviteMeta(invite: FormInvite) {
  if (invite.completedAt) return `Completed ${formatDate(invite.completedAt)}`;
  if (invite.openedAt) return `Opened ${formatDate(invite.openedAt)}`;
  if (invite.sentAt) return `Sent ${formatDate(invite.sentAt)}`;
  return `Created ${formatDate(invite.createdAt)}`;
}

// ── Response Card ────────────────────────────────────────────────────────────

function ResponseCard({
  response,
  fields,
}: {
  response: FormResponse;
  fields: FormField[];
  index: number;
}) {
  const answered = fields.filter((f) => response.answers[f.id] != null && response.answers[f.id] !== "");
  const duration = formatDuration(response.duration);

  const nameField = fields.find(
    (f) => f.id === "name" || f.id === "full_name" || f.type === "text",
  );
  const title = nameField ? String(response.answers[nameField.id] ?? "Unnamed") : "Unnamed";

  return (
    <div className="border-l-[3px] border-coral pl-4 sm:pl-6">
      <div className="mb-7">
        <h3 className="font-display text-2xl font-semibold tracking-tight">
          {title}
        </h3>
        <p className="mt-1 text-[13px] text-stone-400">
          {formatDate(response.createdAt)}
          {duration && <> &middot; {duration}</>}
          {" "}&middot; {response.completed ? "Complete" : "Draft"}
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {answered.map((field) => {
          const value = response.answers[field.id];
          return (
            <div key={field.id}>
              <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-stone-400">
                {shortLabel(field)}
              </p>
              <p className="mt-1.5 text-[15px] leading-relaxed text-stone-900">
                {String(value)}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Share Tab ───────────────────────────────────────────────────────────────

function ShareTab({
  shareUrl,
  slug,
  copied,
  setCopied,
  inviteInput,
  setInviteInput,
  invites,
  sendingInvites,
  inviteError,
  inviteSuccess,
  onSendInvites,
}: {
  shareUrl: string;
  slug: string;
  copied: boolean;
  setCopied: (v: boolean) => void;
  inviteInput: string;
  setInviteInput: (value: string) => void;
  invites: FormInvite[];
  sendingInvites: boolean;
  inviteError: string | null;
  inviteSuccess: string | null;
  onSendInvites: () => void;
}) {
  const qrRef = useRef<HTMLDivElement>(null);
  const parsedEmails = parseInviteEmails(inviteInput);

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
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 truncate rounded-xl border border-stone-200 bg-white px-3 py-3 text-xs sm:px-4 sm:text-sm">
          {shareUrl}
        </code>
        <button
          onClick={() => {
            navigator.clipboard.writeText(shareUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className={`shrink-0 rounded-full border px-4 py-2.5 text-sm transition ${
            copied
              ? "border-emerald-200 bg-emerald-50 text-emerald-600"
              : "border-stone-200 hover:bg-stone-50"
          }`}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* QR Code */}
      <div className="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-stone-200 bg-white p-5 sm:p-8">
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

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
          <div className="flex items-start justify-between gap-6">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-400">
                Email invites
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-stone-900">
                Send this form directly.
              </h3>
              <p className="mt-2 max-w-md text-sm leading-6 text-stone-500">
                Paste one or more email addresses. Each person receives a link
                to this voice form and can open it without logging in.
              </p>
            </div>
            <div className="rounded-full border border-stone-200 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-stone-400">
              {parsedEmails.length} recipient{parsedEmails.length === 1 ? "" : "s"}
            </div>
          </div>

          <textarea
            value={inviteInput}
            onChange={(event) => setInviteInput(event.target.value)}
            rows={7}
            placeholder={"alice@example.com\nbob@example.com"}
            className="mt-5 w-full rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 focus:border-stone-300 focus:bg-white"
          />

          <p className="mt-3 text-xs text-stone-400">
            Separate emails with new lines, commas, or semicolons.
          </p>

          {inviteError && (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {inviteError}
            </div>
          )}

          {inviteSuccess && (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {inviteSuccess}
            </div>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={onSendInvites}
              disabled={sendingInvites || parsedEmails.length === 0}
              className="rounded-full bg-black px-5 py-3 text-sm font-medium text-white transition hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {sendingInvites ? "Sending…" : "Send invites"}
            </button>
            <p className="text-sm text-stone-500">
              Track sent, opened, and completed status per recipient.
            </p>
          </div>
        </section>

        <section className="rounded-3xl border border-stone-200 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-stone-400">
                Invite activity
              </p>
              <h3 className="mt-2 font-display text-2xl font-semibold tracking-tight text-stone-900">
                Recent recipients
              </h3>
            </div>
            <div className="rounded-full border border-stone-200 px-3 py-1 text-[11px] uppercase tracking-[0.14em] text-stone-400">
              {invites.length}
            </div>
          </div>

          {invites.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-stone-200 bg-stone-50 px-4 py-8 text-center text-sm text-stone-400">
              No invites sent yet.
            </div>
          ) : (
            <div className="mt-6 space-y-3">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="rounded-2xl border border-stone-200 px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-sm font-medium text-stone-900">{invite.email}</p>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.12em] ${inviteStatusClasses(invite.status)}`}
                    >
                      {formatInviteStatus(invite.status)}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-stone-400">
                    {buildInviteMeta(invite)}
                  </p>
                  {invite.error && (
                    <p className="mt-2 text-sm text-red-600">{invite.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
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
  const [invites, setInvites] = useState<FormInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"responses" | "share">("responses");
  const [copied, setCopied] = useState(false);
  const [inviteInput, setInviteInput] = useState("");
  const [sendingInvites, setSendingInvites] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [liveStatus, setLiveStatus] = useState<"connecting" | "live" | "offline">(
    "connecting",
  );

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      fetchForm(slug),
      fetchResponses(slug),
      fetchInvites(slug).catch((error) => {
        console.error("Failed to load invites:", error);
        return [];
      }),
    ])
      .then(([f, r, nextInvites]) => {
        setForm(f);
        setResponses(r);
        setInvites(nextInvites);
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

  async function handleSendInvites() {
    if (!slug) return;

    const emails = parseInviteEmails(inviteInput);
    if (emails.length === 0) {
      setInviteError("Paste at least one valid email address.");
      setInviteSuccess(null);
      return;
    }

    setSendingInvites(true);
    setInviteError(null);
    setInviteSuccess(null);

    try {
      const result = await sendInvites(slug, emails);
      setInvites((prev) => [...result.invites, ...prev]);
      setInviteInput("");

      if (result.failedCount > 0) {
        setInviteSuccess(
          `${result.sentCount} invite${result.sentCount === 1 ? "" : "s"} sent, ${result.failedCount} failed.`,
        );
      } else {
        setInviteSuccess(
          `${result.sentCount} invite${result.sentCount === 1 ? "" : "s"} sent successfully.`,
        );
      }
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : "Failed to send invites.");
    } finally {
      setSendingInvites(false);
    }
  }

  if (loading || !form) {
    return <LoadingShell />;
  }

  const shareUrl = `${window.location.origin}/f/${form.slug}`;

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6 sm:py-5">
          <Link
            to="/dashboard"
            className="text-sm text-stone-500 transition hover:text-stone-900"
          >
            &larr; Back
          </Link>
          <div className="flex items-center gap-2">
            <Link
              to={`/dashboard/${form.slug}/edit`}
              className="rounded-full border border-stone-200 px-3 py-2 text-xs transition hover:bg-stone-50 sm:px-4 sm:text-sm"
            >
              Edit
            </Link>
            <button
              onClick={handleDelete}
              className="rounded-full border border-stone-200 px-3 py-2 text-xs text-red-500 transition hover:bg-red-50 sm:px-4 sm:text-sm"
            >
              Delete
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-4xl">
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
          <div className="mt-4">
            {responses.length > 0 && (
              <div className="flex justify-end pb-4">
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
              <div className="divide-y divide-stone-200">
                {responses.map((r, i) => (
                  <div key={r.id} className="py-8 first:pt-0">
                    <ResponseCard
                      response={r}
                      fields={form.fields}
                      index={responses.length - i}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Share tab */}
        {tab === "share" && (
          <ShareTab
            shareUrl={shareUrl}
            slug={form.slug}
            copied={copied}
            setCopied={setCopied}
            inviteInput={inviteInput}
            setInviteInput={setInviteInput}
            invites={invites}
            sendingInvites={sendingInvites}
            inviteError={inviteError}
            inviteSuccess={inviteSuccess}
            onSendInvites={() => void handleSendInvites()}
          />
        )}
      </main>
    </div>
  );
}
