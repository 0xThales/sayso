import { useEffect, useState } from "react";
import { Link } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { fetchForms, deleteForm, type FormSummary } from "@/lib/api";
import { Grain } from "@/components/ui/Grain";
import { LoadingDots } from "@/components/ui/LoadingDots";
import { Waveform } from "@/components/ui/Waveform";

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
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to delete form");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-black font-body">
      <Grain />

      {/* Editorial header */}
      <section className="relative mx-auto max-w-[1600px] px-4 pt-12 pb-10 sm:px-6 sm:pt-16 md:px-8 md:pt-24 md:pb-16">
        <div className="mt-16">
          <h1 className="font-display text-[14vw] font-semibold leading-[0.85] tracking-[-0.04em] md:text-[11vw] lg:text-[10rem]">
            <div className="overflow-hidden">
              <motion.div
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
              >
                Your
              </motion.div>
            </div>
            <div className="overflow-hidden">
              <motion.em
                initial={{ y: "110%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.45 }}
                className="block italic"
              >
                forms.
              </motion.em>
            </div>
          </h1>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.8 }}
          className="mt-12 grid gap-10 md:grid-cols-[1fr_1.3fr_auto] md:items-end"
        >
          <p className="max-w-xs text-[11px] uppercase tracking-[0.28em] text-black/50">
            § A voice-first form builder — every intake is a conversation, not
            a questionnaire.
          </p>
          <p className="max-w-xl font-display text-2xl leading-[1.25] text-black md:text-3xl">
            Voice-first forms that listen to your respondents.{" "}
            <em className="italic text-black/60">
              Start one with your voice.
            </em>
          </p>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.28em] text-black/40">
              Total forms
            </p>
            <motion.p
              key={forms.length}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1 font-display text-5xl font-semibold leading-none"
            >
              {loading ? "—" : String(forms.length).padStart(2, "0")}
            </motion.p>
          </div>
        </motion.div>
      </section>

      {/* Body */}
      <section className="relative mx-auto max-w-[1600px] px-4 pb-16 sm:px-6 md:px-8 md:pb-32">
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center border-y border-black/10 py-20"
            >
              <LoadingDots />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border-y border-black/10 py-20 text-center"
            >
              <p className="text-[11px] uppercase tracking-[0.32em] text-black/50">
                § Error
              </p>
              <p className="mt-4 font-display text-3xl italic text-black">
                {error}
              </p>
            </motion.div>
          ) : forms.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="relative border-y border-black py-16 sm:py-24 md:py-32"
            >
              <div className="grid gap-16 md:grid-cols-[1fr_auto_1fr] md:items-center">
                <div className="hidden md:block">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-black/40">
                    § No forms yet
                  </p>
                  <p className="mt-4 font-display text-2xl leading-[1.2] italic text-black/60">
                    "The voice is the form."
                  </p>
                </div>

                <div className="flex flex-col items-center text-center">
                  {/* Animated waveform as the empty-state visual */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.3, duration: 0.8 }}
                  >
                    <Waveform bars={28} className="h-14 text-black" active />
                  </motion.div>

                  <motion.h2
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.8 }}
                    className="mt-10 font-display text-4xl font-semibold leading-[0.95] tracking-tight md:text-6xl"
                  >
                    Your first form is a{" "}
                    <em className="italic">conversation</em> away.
                  </motion.h2>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6 }}
                    className="mt-8 max-w-md text-base leading-7 text-black/60"
                  >
                    Describe what you need and Sayso builds the form with you,
                    live, by voice.
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 }}
                    className="mt-10"
                  >
                    <Link
                      to="/dashboard/new/voice"
                      className="group inline-flex items-center gap-3 rounded-full bg-black px-6 py-4 text-sm font-medium text-white transition hover:-translate-y-0.5 sm:px-8 sm:py-5"
                    >
                      <span className="relative flex h-2 w-2">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-70" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
                      </span>
                      Create by voice
                      <span className="transition group-hover:translate-x-0.5">
                        →
                      </span>
                    </Link>
                  </motion.div>
                </div>

                <div className="hidden text-right md:block">
                  <p className="text-[10px] uppercase tracking-[0.28em] text-black/40">
                    § How it works
                  </p>
                  <p className="mt-4 font-display text-2xl leading-[1.2] italic text-black/60">
                    You describe it. <br />
                    Sayso builds it.
                  </p>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center justify-between border-b border-black/10 pb-4">
                <p className="text-[11px] uppercase tracking-[0.32em] text-black/50">
                  § The collection
                </p>
                <p className="text-[10px] uppercase tracking-[0.28em] text-black/40">
                  {forms.length} {forms.length === 1 ? "form" : "forms"}
                </p>
              </div>

              <ol className="divide-y divide-black/10 border-b border-black">
                {forms.map((form, i) => (
                  <motion.li
                    key={form.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      delay: i * 0.06,
                      duration: 0.6,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="group relative"
                  >
                    <Link
                      to={`/dashboard/${form.slug}`}
                      className="grid gap-4 py-6 sm:gap-6 sm:py-8 md:grid-cols-[auto_1fr_auto_auto] md:items-baseline md:gap-12"
                    >
                      <span className="font-display text-xs text-black/40">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="min-w-0">
                        <h3 className="font-display text-3xl font-semibold leading-[1] tracking-tight transition group-hover:italic md:text-4xl">
                          {form.title}
                        </h3>
                        {form.description && (
                          <p className="mt-3 max-w-xl text-sm leading-6 text-black/50">
                            {form.description}
                          </p>
                        )}
                        <div className="mt-4 flex flex-wrap items-center gap-4 text-[10px] uppercase tracking-[0.28em] text-black/40">
                          <span>
                            {String(form.fieldCount).padStart(2, "0")}{" "}
                            {form.fieldCount === 1 ? "question" : "questions"}
                          </span>
                          <span className="h-2.5 w-px bg-black/20" />
                          <span>/f/{form.slug}</span>
                          <span className="h-2.5 w-px bg-black/20" />
                          <span>
                            {new Date(form.createdAt).toLocaleDateString(
                              "en-US",
                              {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              },
                            )}
                          </span>
                        </div>
                      </div>
                      <span className="hidden text-[10px] uppercase tracking-[0.28em] text-black/40 md:block">
                        {form.language?.toUpperCase() ?? "EN"}
                      </span>
                      <motion.span
                        className="font-display text-2xl text-black/30 transition group-hover:text-black"
                        whileHover={{ x: 4 }}
                      >
                        →
                      </motion.span>
                    </Link>

                    {/* Row actions — always visible on mobile, hover on desktop */}
                    <div className="flex gap-2 md:pointer-events-none md:absolute md:right-0 md:top-8 md:opacity-0 md:transition md:group-hover:pointer-events-auto md:group-hover:opacity-100">
                      <Link
                        to={`/dashboard/${form.slug}/edit`}
                        className="rounded-full border border-black/20 bg-white px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-black transition hover:border-black"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          void handleDelete(form.id, form.title);
                        }}
                        className="rounded-full border border-black/20 bg-white px-4 py-2 text-[10px] uppercase tracking-[0.24em] text-black transition hover:border-black hover:bg-black hover:text-white"
                      >
                        Delete
                      </button>
                    </div>
                  </motion.li>
                ))}
              </ol>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-black/10">
        <div className="mx-auto flex max-w-[1600px] items-center justify-end px-4 py-6 sm:px-6 md:px-8 md:py-8">
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
