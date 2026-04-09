import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  motion,
  useScroll,
  useTransform,
  useMotionValue,
  useSpring,
  AnimatePresence,
  useInView,
} from "framer-motion";

const marqueeWords = [
  "Founder calls",
  "Customer research",
  "Recruiting",
  "Patient intake",
  "Market surveys",
  "Onboarding",
  "Waitlist triage",
  "Product feedback",
];

const howItWorks = [
  {
    step: "01",
    title: "Design the form",
    body: "Write your questions once. Sayso handles the flow, the follow-ups, and the tone.",
  },
  {
    step: "02",
    title: "Hand it to the agent",
    body: "An ElevenLabs voice agent guides every respondent through the intake, live.",
  },
  {
    step: "03",
    title: "Get structured answers",
    body: "Client tools capture every reply as clean data, ready for your CRM or dashboard.",
  },
];

const features = [
  { k: "01", t: "Voice-native", b: "Respondents talk. Sayso listens, clarifies, and keeps the conversation on rails." },
  { k: "02", t: "Structured output", b: "Every answer lands in a typed schema. No transcripts to parse." },
  { k: "03", t: "Client-side tools", b: "The agent saves fields, branches logic, and completes the form in the browser." },
  { k: "04", t: "Any language", b: "Drop in any ElevenLabs voice. Switch languages mid-flow without losing state." },
];

const useCases = [
  { kicker: "Founders", title: "Discovery calls", body: "A two-minute voice intake that actually gets finished." },
  { kicker: "Research", title: "Customer interviews", body: "The same warm, structured conversation with a hundred people in a week." },
  { kicker: "Recruiting", title: "Screener calls", body: "Let candidates talk through their story before you look at a resume." },
  { kicker: "Healthcare", title: "Patient intake", body: "Replace the clipboard with a calm, accessible voice conversation." },
  { kicker: "Market research", title: "Surveys that finish", body: "Double completion rates by letting people speak instead of typing." },
  { kicker: "Community", title: "Waitlist triage", body: "Qualify every signup in under a minute, hands-free." },
];

function Waveform({ bars = 24, className = "" }: { bars?: number; className?: string }) {
  return (
    <div className={`flex h-16 items-end gap-1 ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <motion.span
          key={i}
          className="w-1 rounded-full bg-current"
          initial={{ scaleY: 0.3 }}
          animate={{
            scaleY: [0.3, 1, 0.5, 0.9, 0.3],
          }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            delay: i * 0.06,
            ease: "easeInOut",
          }}
          style={{ height: "100%", transformOrigin: "bottom" }}
        />
      ))}
    </div>
  );
}

function MagneticButton({
  children,
  className = "",
  ...props
}: React.ComponentProps<typeof motion.a>) {
  const ref = useRef<HTMLAnchorElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 300, damping: 20 });
  const sy = useSpring(y, { stiffness: 300, damping: 20 });

  return (
    <motion.a
      ref={ref}
      className={className}
      style={{ x: sx, y: sy }}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect();
        if (!r) return;
        x.set((e.clientX - r.left - r.width / 2) * 0.3);
        y.set((e.clientY - r.top - r.height / 2) * 0.3);
      }}
      onMouseLeave={() => {
        x.set(0);
        y.set(0);
      }}
      {...props}
    >
      {children}
    </motion.a>
  );
}

function Reveal({
  children,
  delay = 0,
  y = 40,
}: {
  children: React.ReactNode;
  delay?: number;
  y?: number;
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Landing() {
  const { scrollYProgress } = useScroll();
  const heroY = useTransform(scrollYProgress, [0, 0.2], [0, -120]);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.15], [1, 0.3]);

  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 4), 2800);
    return () => clearInterval(id);
  }, []);
  const liveQuestions = [
    "What's the hardest problem your customers face?",
    "When did you last change how you onboard users?",
    "What would make this form feel effortless?",
    "Who else should we be talking to?",
  ];

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-black font-body">
      {/* Subtle grain texture */}
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /></filter><rect width='100%25' height='100%25' filter='url(%23n)' /></svg>\")",
        }}
      />

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
          <div className="hidden items-center gap-10 md:flex">
            <a href="#how" className="text-sm text-black/60 transition hover:text-black">
              How it works
            </a>
            <a href="#features" className="text-sm text-black/60 transition hover:text-black">
              Features
            </a>
            <a href="#use-cases" className="text-sm text-black/60 transition hover:text-black">
              Use cases
            </a>
            <a href="#developers" className="text-sm text-black/60 transition hover:text-black">
              Developers
            </a>
          </div>
          <Link
            to="/dashboard"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition"
          >
            <span className="relative z-10">Try a demo</span>
            <span className="relative z-10 transition group-hover:translate-x-0.5">→</span>
            <span className="absolute inset-0 -translate-x-full bg-white transition-transform duration-500 group-hover:translate-x-0" />
            <span className="absolute inset-0 flex items-center justify-center gap-2 text-black opacity-0 transition-opacity duration-500 group-hover:opacity-100">
              Try a demo →
            </span>
          </Link>
        </div>
      </motion.nav>

      {/* Hero */}
      <motion.section
        style={{ y: heroY, opacity: heroOpacity }}
        className="relative mx-auto max-w-[1600px] px-8 pt-24 pb-32"
      >
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="flex items-center gap-4"
        >
          <div className="h-px flex-1 bg-black/20" />
          <span className="text-[11px] uppercase tracking-[0.32em] text-black/60">
            ● Built with ElevenLabs v3 · Est. MMXXVI
          </span>
          <div className="h-px flex-1 bg-black/20" />
        </motion.div>

        {/* H1 — oversized editorial with word reveal */}
        <div className="mt-20">
          <h1 className="font-display text-[18vw] font-semibold leading-[0.85] tracking-[-0.04em] text-black md:text-[14vw]">
            <div className="overflow-hidden">
              <motion.div
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
              >
                Forms
              </motion.div>
            </div>
            <div className="flex items-baseline gap-[0.3em] overflow-hidden">
              <motion.span
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.45 }}
                className="block"
              >
                that
              </motion.span>
              <motion.em
                initial={{ y: "110%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                transition={{ duration: 1, ease: [0.22, 1, 0.36, 1], delay: 0.6 }}
                className="block italic"
              >
                listen.
              </motion.em>
            </div>
          </h1>
        </div>

        {/* Sub row */}
        <div className="mt-16 grid gap-10 md:grid-cols-[1fr_1.3fr_auto] md:items-end">
          <Reveal delay={0.9}>
            <p className="max-w-xs text-[11px] uppercase tracking-[0.28em] text-black/50">
              § A voice-first form builder — the respondent talks, the agent listens, the data arrives structured.
            </p>
          </Reveal>
          <Reveal delay={1}>
            <p className="max-w-xl font-display text-2xl leading-[1.2] text-black md:text-3xl">
              Stop making people fill out forms.{" "}
              <em className="italic text-black/70">Let them talk.</em>
            </p>
          </Reveal>
          <Reveal delay={1.1}>
            <div className="flex flex-wrap items-center gap-3">
              <MagneticButton
                href="/dashboard"
                className="group inline-flex items-center gap-2 rounded-full bg-black px-7 py-4 text-sm font-medium text-white"
              >
                Try a live demo
                <span className="transition group-hover:translate-x-1">→</span>
              </MagneticButton>
              <a
                href="#how"
                className="rounded-full border border-black/20 px-7 py-4 text-sm font-medium text-black transition hover:border-black"
              >
                See how it works
              </a>
            </div>
          </Reveal>
        </div>

        {/* Live waveform strip */}
        <Reveal delay={1.3}>
          <div className="mt-24 flex items-center gap-6">
            <span className="text-[10px] uppercase tracking-[0.28em] text-black/50">
              ● Listening
            </span>
            <Waveform bars={56} className="h-14 flex-1 text-black" />
            <span className="text-[10px] uppercase tracking-[0.28em] text-black/50">
              00:47
            </span>
          </div>
        </Reveal>
      </motion.section>

      {/* Marquee strip */}
      <section className="relative border-y border-black/10 bg-black py-8 text-white">
        <motion.div
          className="flex gap-16 whitespace-nowrap"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
        >
          {[...marqueeWords, ...marqueeWords, ...marqueeWords].map((w, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-16 font-display text-5xl font-semibold tracking-tight md:text-7xl"
            >
              {w}
              <span className="text-white/30">✦</span>
            </span>
          ))}
        </motion.div>
      </section>

      {/* Live product mock */}
      <section className="relative mx-auto max-w-[1600px] px-8 py-32">
        <div className="grid gap-16 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.32em] text-black/50">
              § 01 — The experience
            </p>
            <h2 className="mt-6 font-display text-6xl font-semibold leading-[0.95] tracking-tight md:text-8xl">
              Like a phone call,{" "}
              <em className="italic">only better</em>.
            </h2>
            <p className="mt-8 max-w-md text-lg leading-8 text-black/60">
              The respondent speaks in their own words. Sayso re-asks, clarifies,
              and moves on. You see structured answers arrive in real time.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <div className="relative">
              {/* Floating mock product UI */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="relative overflow-hidden rounded-[2.5rem] border border-black bg-white shadow-[16px_16px_0_0_rgba(0,0,0,1)]"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-black/10 px-8 py-5">
                  <div className="flex items-center gap-3">
                    <motion.span
                      className="inline-block h-2.5 w-2.5 rounded-full bg-black"
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                    />
                    <span className="text-[10px] uppercase tracking-[0.28em] text-black/60">
                      founder_fit · live
                    </span>
                  </div>
                  <span className="text-[10px] uppercase tracking-[0.24em] text-black/40">
                    ● Mic on
                  </span>
                </div>

                {/* Conversation body */}
                <div className="space-y-6 px-8 py-10">
                  <div>
                    <p className="mb-2 text-[10px] uppercase tracking-[0.28em] text-black/40">
                      Agent
                    </p>
                    <AnimatePresence mode="wait">
                      <motion.div
                        key={tick}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        transition={{ duration: 0.4 }}
                        className="rounded-2xl rounded-tl-sm border border-black/10 bg-black/[0.03] px-5 py-4"
                      >
                        <p className="font-display text-xl leading-7 text-black">
                          {liveQuestions[tick]}
                        </p>
                      </motion.div>
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center gap-3">
                    <Waveform bars={20} className="h-10 text-black" />
                    <span className="text-[10px] uppercase tracking-[0.24em] text-black/40">
                      Listening
                    </span>
                  </div>

                  {/* Progress */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.24em] text-black/40">
                      <span>Progress</span>
                      <span>{tick + 1} of 7</span>
                    </div>
                    <div className="mt-3 h-px bg-black/10">
                      <motion.div
                        className="h-full bg-black"
                        animate={{ width: `${((tick + 1) / 7) * 100}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between border-t border-black/10 px-8 py-4">
                  <p className="text-[10px] uppercase tracking-[0.24em] text-black/40">
                    Powered by ElevenLabs
                  </p>
                  <p className="font-display italic text-black/60">sayso</p>
                </div>
              </motion.div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="relative border-t border-black/10 py-32">
        <div className="mx-auto max-w-[1600px] px-8">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.32em] text-black/50">
              § 02 — How it works
            </p>
            <h2 className="mt-6 font-display text-6xl font-semibold leading-[0.95] tracking-tight md:text-9xl">
              Three steps. <em className="italic">No typing.</em>
            </h2>
          </Reveal>

          <div className="mt-24 grid gap-12 md:grid-cols-3 md:gap-8">
            {howItWorks.map((s, i) => (
              <Reveal key={s.step} delay={i * 0.15}>
                <div className="group border-t border-black pt-8">
                  <motion.p
                    className="font-display text-[8rem] font-semibold leading-none tracking-tight"
                    whileHover={{ x: 8 }}
                    transition={{ duration: 0.4 }}
                  >
                    {s.step}
                  </motion.p>
                  <h3 className="mt-8 font-display text-3xl font-semibold">
                    {s.title}
                  </h3>
                  <p className="mt-4 text-base leading-7 text-black/60">
                    {s.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Features — big black block inversion */}
      <section id="features" className="relative bg-black py-32 text-white">
        <div className="mx-auto max-w-[1600px] px-8">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.32em] text-white/50">
              § 03 — What you get
            </p>
            <h2 className="mt-6 max-w-5xl font-display text-6xl font-semibold leading-[0.95] tracking-tight md:text-8xl">
              A form that feels like a{" "}
              <em className="italic text-white/70">conversation</em>.
            </h2>
          </Reveal>

          <div className="mt-24 grid gap-px bg-white/10 md:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <Reveal key={f.k} delay={i * 0.1}>
                <motion.div
                  whileHover={{ backgroundColor: "rgb(255 255 255 / 0.05)" }}
                  className="flex h-full flex-col justify-between gap-16 bg-black p-10"
                >
                  <p className="font-display text-2xl text-white/40">{f.k}</p>
                  <div>
                    <h3 className="font-display text-3xl font-semibold">{f.t}</h3>
                    <p className="mt-4 text-sm leading-7 text-white/60">{f.b}</p>
                  </div>
                </motion.div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="relative border-t border-black/10 py-32">
        <div className="mx-auto max-w-[1600px] px-8">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.32em] text-black/50">
              § 04 — Use cases
            </p>
            <h2 className="mt-6 max-w-5xl font-display text-6xl font-semibold leading-[0.95] tracking-tight md:text-9xl">
              Anywhere a form <em className="italic">dies</em>, Sayso lives.
            </h2>
          </Reveal>

          <div className="mt-24 grid gap-px bg-black md:grid-cols-2 lg:grid-cols-3">
            {useCases.map((u, i) => (
              <Reveal key={u.title} delay={i * 0.08}>
                <motion.article
                  whileHover="hover"
                  className="group relative flex h-full flex-col justify-between gap-20 bg-white p-10 transition"
                >
                  <div className="flex items-start justify-between">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-black/50">
                      {u.kicker}
                    </p>
                    <motion.span
                      variants={{ hover: { rotate: 45, x: 4, y: -4 } }}
                      transition={{ duration: 0.4 }}
                      className="font-display text-2xl"
                    >
                      →
                    </motion.span>
                  </div>
                  <div>
                    <h3 className="font-display text-4xl font-semibold leading-[1]">
                      {u.title}
                    </h3>
                    <p className="mt-4 text-sm leading-7 text-black/60">
                      {u.body}
                    </p>
                  </div>
                  <motion.div
                    variants={{
                      hover: { scaleX: 1 },
                    }}
                    initial={{ scaleX: 0 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute bottom-0 left-0 h-1 w-full origin-left bg-black"
                  />
                </motion.article>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Developers */}
      <section id="developers" className="relative border-t border-black/10 bg-white py-32">
        <div className="mx-auto max-w-[1600px] px-8">
          <div className="grid gap-20 lg:grid-cols-[1fr_1.1fr] lg:items-center">
            <Reveal>
              <p className="text-[11px] uppercase tracking-[0.32em] text-black/50">
                § 05 — For developers
              </p>
              <h2 className="mt-6 font-display text-6xl font-semibold leading-[0.95] tracking-tight md:text-8xl">
                Ship in an <em className="italic">afternoon</em>.
              </h2>
              <p className="mt-8 max-w-md text-lg leading-8 text-black/60">
                Sayso runs on a Hono API and the ElevenLabs React SDK. Request a
                signed URL, drop in your agent, ship a voice form to production.
              </p>
              <ul className="mt-12 space-y-5">
                {[
                  "Signed URLs from a tiny Hono backend",
                  "React SDK for client-side voice sessions",
                  "Client tools to save answers into your app state",
                  "Full transcript + structured output, always in sync",
                ].map((item, i) => (
                  <Reveal key={item} delay={i * 0.08}>
                    <li className="flex items-start gap-4 border-t border-black/10 pt-5 text-base">
                      <span className="font-display text-sm text-black/40">
                        0{i + 1}
                      </span>
                      <span>{item}</span>
                    </li>
                  </Reveal>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={0.2}>
              <motion.div
                whileHover={{ rotate: -0.5, y: -4 }}
                transition={{ duration: 0.4 }}
                className="overflow-hidden rounded-[2rem] border border-black bg-black text-white shadow-[16px_16px_0_0_rgba(0,0,0,1)]"
              >
                <div className="flex items-center gap-2 border-b border-white/10 px-6 py-4">
                  <span className="h-2.5 w-2.5 rounded-full bg-white/80" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/40" />
                  <span className="h-2.5 w-2.5 rounded-full bg-white/20" />
                  <span className="ml-3 text-[10px] uppercase tracking-[0.24em] text-white/40">
                    sayso.ts
                  </span>
                </div>
                <pre className="overflow-x-auto p-8 font-mono text-[13px] leading-6">
                  <code>{`import { useConversation } from "@elevenlabs/react";
import { getSignedUrl } from "@/lib/elevenlabs";

const convo = useConversation({
  onMessage: (e) => console.log(e.message),
});

// Launch a voice form in one line.
convo.startSession({
  signedUrl: await getSignedUrl(),
  overrides: { agent: { prompt } },
});`}</code>
                </pre>
              </motion.div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Pull quote */}
      <section className="relative border-t border-black/10 py-40">
        <div className="mx-auto max-w-5xl px-8 text-center">
          <Reveal>
            <p className="text-[11px] uppercase tracking-[0.32em] text-black/50">
              § Testimonial
            </p>
          </Reveal>
          <Reveal delay={0.2}>
            <blockquote className="mt-12 font-display text-4xl font-medium leading-[1.1] tracking-tight md:text-7xl">
              <em className="italic">
                "We replaced our onboarding form with Sayso and completion jumped
                from 38% to 91% overnight."
              </em>
            </blockquote>
          </Reveal>
          <Reveal delay={0.3}>
            <p className="mt-12 text-sm uppercase tracking-[0.28em] text-black/50">
              — Early access customer
            </p>
          </Reveal>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="relative overflow-hidden border-t border-black/10 bg-black py-40 text-white">
        <motion.div
          className="absolute inset-x-0 top-0 flex gap-16 whitespace-nowrap opacity-[0.06]"
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <span
              key={i}
              className="font-display text-[20rem] font-semibold leading-none"
            >
              sayso ✦
            </span>
          ))}
        </motion.div>
        <div className="relative mx-auto max-w-[1600px] px-8 text-center">
          <Reveal>
            <h2 className="font-display text-7xl font-semibold leading-[0.9] tracking-tight md:text-[11rem]">
              Start the
              <br />
              <em className="italic">conversation</em>.
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <div className="mt-16 flex flex-wrap items-center justify-center gap-4">
              <MagneticButton
                href="/dashboard"
                className="group inline-flex items-center gap-2 rounded-full bg-white px-10 py-6 text-base font-medium text-black"
              >
                Try a live demo
                <span className="transition group-hover:translate-x-1">→</span>
              </MagneticButton>
              <a
                href="#how"
                className="rounded-full border border-white/30 px-10 py-6 text-base font-medium text-white transition hover:border-white"
              >
                See how it works
              </a>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative border-t border-black/10 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col items-start justify-between gap-8 px-8 py-12 md:flex-row md:items-center">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-black" />
            <span className="font-display text-xl font-semibold tracking-tight">
              sayso
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-8 text-sm text-black/50">
            <a href="#how" className="hover:text-black">How it works</a>
            <a href="#features" className="hover:text-black">Features</a>
            <a href="#use-cases" className="hover:text-black">Use cases</a>
            <a href="#developers" className="hover:text-black">Developers</a>
            <Link to="/dashboard" className="hover:text-black">Demo</Link>
          </div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-black/40">
            © {new Date().getFullYear()} sayso — the voice is the form
          </p>
        </div>
      </footer>
    </main>
  );
}
