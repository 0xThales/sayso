import { Link } from "react-router";

export function Landing() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-cream">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,107,90,0.24),transparent_35%),linear-gradient(180deg,rgba(255,255,255,0.75),rgba(255,248,240,1))]" />
      <div className="pointer-events-none absolute left-0 top-20 h-72 w-72 rounded-full bg-coral/20 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-1/3 h-96 w-96 rounded-full bg-stone-900/8 blur-3xl" />

      <section className="relative mx-auto flex min-h-screen max-w-6xl flex-col justify-between px-6 py-8">
        <header className="flex items-center justify-between">
          <h1 className="font-display text-4xl font-semibold tracking-tight text-stone-900">
            say<span className="text-coral">so</span>
          </h1>
          <p className="text-xs uppercase tracking-[0.28em] text-stone-500">
            Voice-first forms
          </p>
        </header>

        <div className="grid items-end gap-10 py-16 lg:grid-cols-[1fr_24rem]">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-coral-dark">
              The voice is the form
            </p>
            <h2 className="mt-4 max-w-4xl font-display text-6xl leading-none font-semibold tracking-tight text-stone-900 md:text-8xl">
              Intake that sounds human before it looks structured.
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-stone-600">
              Sayso turns a static questionnaire into a guided conversation,
              powered by ElevenLabs conversation sessions and client-side tools.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                to="/form/founder_fit"
                className="rounded-full bg-coral px-6 py-3 text-sm font-medium text-white transition hover:bg-coral-dark"
              >
                Try the live demo
              </Link>
              <a
                href="#how-it-works"
                className="rounded-full border border-stone-900/10 px-6 py-3 text-sm font-medium text-stone-700 transition hover:border-stone-900 hover:text-stone-900"
              >
                See the flow
              </a>
            </div>
          </div>

          <div className="rounded-[2rem] border border-stone-900/10 bg-white/70 p-6 shadow-[0_24px_80px_rgba(38,24,18,0.08)] backdrop-blur">
            <p className="text-xs uppercase tracking-[0.24em] text-stone-400">
              Demo form
            </p>
            <h3 className="mt-3 font-display text-3xl font-semibold text-stone-900">
              Founder Fit Call
            </h3>
            <p className="mt-4 text-sm leading-7 text-stone-600">
              A premium, voice-native intake for early customer conversations.
            </p>

            <div className="mt-8 space-y-3">
              {[
                "Signed URL from the API",
                "Live mic session with ElevenLabs",
                "Client tools for structured answers",
                "Transcript plus completion state",
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-[1.25rem] border border-stone-900/10 bg-[#fffaf5] px-4 py-3 text-sm text-stone-700"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          id="how-it-works"
          className="grid gap-4 border-t border-stone-900/10 py-6 text-sm text-stone-500 md:grid-cols-3"
        >
          <p>1. The frontend requests a signed conversation URL from Hono.</p>
          <p>2. ElevenLabs runs the voice session with a dynamic form prompt.</p>
          <p>3. Client tools write structured answers back into the UI.</p>
        </div>
      </section>
    </main>
  );
}
