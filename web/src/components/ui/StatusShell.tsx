import { Link } from "react-router";
import { motion } from "framer-motion";
import { Grain } from "./Grain";
import { LoadingDots } from "./LoadingDots";

export function StatusShell({
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

export function LoadingShell() {
  return (
    <StatusShell
      kicker="§ Loading"
      title={
        <>
          Tuning the <em className="italic">mic</em>…
        </>
      }
    >
      <LoadingDots />
    </StatusShell>
  );
}

export function ErrorShell({ message }: { message: string }) {
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

export function NotFoundShell() {
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
