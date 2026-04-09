import { useNavigate, Link } from "react-router";
import { motion } from "framer-motion";

// ── Background ───────────────────────────────────────────────────────────────

function DottedCanvas() {
  return (
    <>
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.25]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(0,0,0,0.5) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0 opacity-[0.04] mix-blend-multiply"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /></filter><rect width='100%25' height='100%25' filter='url(%23n)' /></svg>\")",
        }}
      />
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(255,255,255,0.7) 80%, rgba(255,255,255,0.95) 100%)",
        }}
      />
    </>
  );
}

// ── Agent card ───────────────────────────────────────────────────────────────

type Agent = {
  id: string;
  name: string;
  tagline: string;
  description: string;
  image: string;
};

const AGENTS: Agent[] = [
  {
    id: "nadhi",
    name: "Nadhi",
    tagline: "Warm · Curious",
    description:
      "Listens closely and asks the gentle follow-ups that draw out the real answer.",
    image: "/nadhi.png",
  },
  {
    id: "tim",
    name: "Tim",
    tagline: "Direct · Witty",
    description:
      "Keeps things moving with sharp questions and a touch of dry humor.",
    image: "/tim.png",
  },
];

function AgentCard({
  agent,
  index,
  onSelect,
}: {
  agent: Agent;
  index: number;
  onSelect: () => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={onSelect}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: 0.6 + index * 0.12,
        duration: 0.9,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -6 }}
      className="group relative flex w-full max-w-sm flex-col items-center text-left"
    >
      {/* Frame */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-sm border border-black/10 bg-white">
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage:
              "radial-gradient(circle, rgba(0,0,0,0.4) 1px, transparent 1px)",
            backgroundSize: "10px 10px",
          }}
        />
        <img
          src={agent.image}
          alt={agent.name}
          className="relative h-full w-full object-cover transition duration-700 group-hover:scale-[1.03]"
        />
        {/* Number */}
        <div className="absolute left-4 top-4 font-display text-xs tracking-[0.32em] text-black/60">
          № 0{index + 1}
        </div>
        {/* Hover overlay */}
        <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/5" />
      </div>

      {/* Caption */}
      <div className="mt-6 flex w-full items-end justify-between gap-4">
        <div>
          <p className="text-[10px] uppercase tracking-[0.32em] text-black/50">
            § {agent.tagline}
          </p>
          <h2 className="mt-2 font-display text-4xl font-semibold leading-none tracking-tight">
            {agent.name}
            <em className="italic text-black/40">.</em>
          </h2>
        </div>
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-black/20 text-base transition group-hover:border-black group-hover:bg-black group-hover:text-white">
          →
        </span>
      </div>

      <p className="mt-4 max-w-xs text-sm leading-6 text-black/60">
        {agent.description}
      </p>
    </motion.button>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AgentSelect() {
  const navigate = useNavigate();

  const handleSelect = (_agentId: string) => {
    // For now, both agents route to the same creator session.
    navigate("/dashboard/new/voice/create");
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-white text-black font-body">
      <DottedCanvas />

      {/* Nav */}
      <motion.nav
        initial={{ y: -40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-20 flex items-center justify-between px-8 py-5"
      >
        <Link
          to="/dashboard"
          className="group flex items-center gap-2 text-sm text-black/60 transition hover:text-black"
        >
          <span className="transition group-hover:-translate-x-0.5">←</span>
          Back
        </Link>
        <div className="flex items-center gap-2.5">
          <motion.span
            className="inline-block h-2 w-2 rounded-full bg-black"
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          <span className="font-display text-2xl font-semibold tracking-tight">
            sayso
          </span>
        </div>
        <div className="min-w-[60px] text-right text-[10px] uppercase tracking-[0.28em] text-black/50">
          Step 01 / 02
        </div>
      </motion.nav>

      {/* Hero */}
      <section className="relative z-10 mx-auto flex max-w-6xl flex-col items-center px-8 pt-10 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.8 }}
          className="flex items-center gap-4"
        >
          <div className="h-px w-16 bg-black/20" />
          <span className="text-[11px] uppercase tracking-[0.32em] text-black/60">
            § Choose your interviewer
          </span>
          <div className="h-px w-16 bg-black/20" />
        </motion.div>

        <div className="mt-10 text-center">
          <h1 className="font-display text-6xl font-semibold leading-[0.9] tracking-[-0.03em] md:text-7xl lg:text-8xl">
            <div className="overflow-hidden">
              <motion.div
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{
                  duration: 1,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.3,
                }}
              >
                Pick a voice
              </motion.div>
            </div>
            <div className="overflow-hidden">
              <motion.em
                initial={{ y: "110%", opacity: 0 }}
                animate={{ y: "0%", opacity: 1 }}
                transition={{
                  duration: 1,
                  ease: [0.22, 1, 0.36, 1],
                  delay: 0.45,
                }}
                className="block italic text-black/60"
              >
                to build with you.
              </motion.em>
            </div>
          </h1>
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.8 }}
          className="mt-8 max-w-md text-center text-base leading-7 text-black/60"
        >
          You'll have a real conversation. They'll ask, you'll talk, and a form
          will take shape between you.
        </motion.p>

        {/* Cards */}
        <div className="mt-20 grid w-full grid-cols-1 gap-14 md:grid-cols-2 md:gap-10 lg:gap-20">
          {AGENTS.map((agent, i) => (
            <div key={agent.id} className="flex justify-center">
              <AgentCard
                agent={agent}
                index={i}
                onSelect={() => handleSelect(agent.id)}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <div className="relative z-10 mx-auto flex max-w-[1600px] items-center justify-between px-8 py-6 text-[10px] uppercase tracking-[0.28em] text-black/40">
        <span>Powered by ElevenLabs</span>
        <span className="hidden md:block">The voice is the form</span>
      </div>
    </main>
  );
}
