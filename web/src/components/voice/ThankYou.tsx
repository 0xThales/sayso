import { Link } from "react-router";
import { motion } from "framer-motion";
import { Grain } from "@/components/ui/Grain";
import type { Form } from "@/lib/api";

export function ThankYou({
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
