import { useEffect, useState } from "react";
import { Link } from "react-router";
import { UserButton } from "@clerk/clerk-react";
import { fetchForms, deleteForm, type FormSummary } from "@/lib/api";

export function Dashboard() {
  const [forms, setForms] = useState<FormSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchForms()
      .then(setForms)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string, title: string) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteForm(id);
      setForms((prev) => prev.filter((f) => f.id !== id));
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-stone-200">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <Link to="/" className="font-display text-xl font-semibold tracking-tight">
            sayso
          </Link>
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard/new/voice"
              className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-5 py-2.5 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-900"
            >
              Create by voice
            </Link>
            <Link
              to="/dashboard/new"
              className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition hover:bg-stone-800"
            >
              New form <span>+</span>
            </Link>
            <UserButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <h1 className="font-display text-4xl font-semibold tracking-tight">
          Your forms
        </h1>
        <p className="mt-2 text-stone-500">
          Create voice-first forms that listen to your respondents.
        </p>

        {loading && (
          <div className="mt-16 text-center text-stone-400">Loading...</div>
        )}

        {error && (
          <div className="mt-16 text-center text-red-500">{error}</div>
        )}

        {!loading && !error && forms.length === 0 && (
          <div className="mt-20 flex flex-col items-center text-center">
            <div className="text-6xl opacity-20">~</div>
            <h2 className="mt-4 font-display text-2xl font-semibold">
              Your first form is a conversation away
            </h2>
            <p className="mt-2 max-w-md text-stone-500">
              Create a form and let an AI voice agent collect responses
              through natural conversation.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/dashboard/new/voice"
                className="inline-flex items-center gap-2 rounded-full border border-stone-200 px-7 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-400 hover:text-stone-900"
              >
                Create by voice
              </Link>
              <Link
                to="/dashboard/new"
                className="inline-flex items-center gap-2 rounded-full bg-black px-7 py-3 text-sm font-medium text-white transition hover:bg-stone-800"
              >
                Write it manually <span>+</span>
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && forms.length > 0 && (
          <div className="mt-10 space-y-3">
            {forms.map((form) => (
              <div
                key={form.id}
                className="group flex items-center justify-between rounded-xl border border-stone-200 px-6 py-5 transition hover:border-stone-300 hover:shadow-sm"
              >
                <Link to={`/dashboard/${form.slug}`} className="min-w-0 flex-1">
                  <h3 className="font-display text-lg font-semibold tracking-tight">
                    {form.title}
                  </h3>
                  <div className="mt-1 flex items-center gap-4 text-sm text-stone-400">
                    <span>{form.fieldCount} fields</span>
                    <span>/f/{form.slug}</span>
                    <span>
                      {new Date(form.createdAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </Link>
                <div className="flex items-center gap-2 opacity-0 transition group-hover:opacity-100">
                  <Link
                    to={`/dashboard/${form.slug}/edit`}
                    className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm transition hover:bg-stone-50"
                  >
                    Edit
                  </Link>
                  <button
                    onClick={() => handleDelete(form.id, form.title)}
                    className="rounded-lg border border-stone-200 px-3 py-1.5 text-sm text-red-500 transition hover:bg-red-50"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
