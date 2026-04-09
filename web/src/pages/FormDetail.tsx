import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router";
import { fetchForm, fetchResponses, deleteForm } from "@/lib/api";
import type { Form, FormResponse } from "@/types/forms";

export function FormDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<Form | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"responses" | "share">("responses");

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
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-stone-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
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

      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          {form.title}
        </h1>
        {form.description && (
          <p className="mt-2 text-stone-500">{form.description}</p>
        )}
        <div className="mt-2 text-sm text-stone-400">
          {form.fields.length} questions &middot; {responses.length} responses
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
          <div className="mt-6">
            {responses.length === 0 ? (
              <div className="py-16 text-center text-stone-400">
                No responses yet. Share your form to start collecting answers.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-stone-200">
                      <th className="pb-3 pr-4 font-medium text-stone-500">
                        #
                      </th>
                      {form.fields.map((f) => (
                        <th
                          key={f.id}
                          className="pb-3 pr-4 font-medium text-stone-500"
                        >
                          {f.label}
                        </th>
                      ))}
                      <th className="pb-3 pr-4 font-medium text-stone-500">
                        Date
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {responses.map((r, i) => (
                      <tr
                        key={r.id}
                        className="border-b border-stone-100 last:border-0"
                      >
                        <td className="py-3 pr-4 text-stone-400">
                          {responses.length - i}
                        </td>
                        {form.fields.map((f) => (
                          <td
                            key={f.id}
                            className="max-w-[200px] truncate py-3 pr-4"
                          >
                            {String(r.answers[f.id] ?? "—")}
                          </td>
                        ))}
                        <td className="py-3 pr-4 text-stone-400">
                          {new Date(r.createdAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Share tab */}
        {tab === "share" && (
          <div className="mt-8">
            <p className="text-sm text-stone-500">
              Share this link with respondents. They'll talk to a voice agent
              that walks them through your form.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <code className="flex-1 rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
                {shareUrl}
              </code>
              <button
                onClick={() => navigator.clipboard.writeText(shareUrl)}
                className="rounded-full border border-stone-200 px-4 py-2.5 text-sm transition hover:bg-stone-50"
              >
                Copy
              </button>
            </div>
            <div className="mt-6">
              <Link
                to={`/f/${form.slug}`}
                target="_blank"
                className="inline-flex items-center gap-2 text-sm font-medium text-stone-700 transition hover:text-black"
              >
                Open form &rarr;
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
