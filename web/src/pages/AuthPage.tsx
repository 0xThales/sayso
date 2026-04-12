import { SignIn, SignUp } from "@clerk/clerk-react";
import { motion } from "framer-motion";
import { Waveform } from "@/components/ui/Waveform";

const ease = [0.22, 1, 0.36, 1] as const;

const clerkAppearance = {
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "w-full shadow-none p-0 bg-transparent",
    headerTitle:
      "font-display text-[28px] font-semibold tracking-tight text-black",
    headerSubtitle: "font-body text-sm text-black/50",
    socialButtonsBlockButton:
      "rounded-full border border-black/15 bg-white px-5 py-3.5 font-body text-sm font-medium text-black hover:border-black/40 transition-colors",
    socialButtonsBlockButtonText: "font-body font-medium",
    dividerRow: "my-5",
    dividerLine: "bg-black/10",
    dividerText:
      "font-body text-[11px] uppercase tracking-[0.08em] text-black/35",
    formFieldLabel: "font-body text-[13px] font-medium text-black mb-1.5",
    formFieldInput:
      "rounded-xl border border-black/15 bg-white px-4 py-3.5 font-body text-sm text-black placeholder:text-black/30 focus:border-black focus:ring-0 transition-colors",
    formButtonPrimary:
      "rounded-full bg-black px-7 py-4 font-body text-sm font-medium text-white hover:bg-black/85 transition-colors shadow-none",
    footerAction: "justify-center",
    footerActionText: "font-body text-[13px] text-black/45",
    footerActionLink:
      "font-body text-[13px] font-medium text-black border-b border-black/20 hover:border-black transition-colors",
    footer: "bg-transparent [&>div:last-child]:hidden",
  },
  variables: {
    colorPrimary: "#000000",
    colorText: "#000000",
    colorTextSecondary: "rgba(0,0,0,0.5)",
    colorInputText: "#000000",
    colorInputBackground: "#FFFFFF",
    fontFamily: '"DM Sans", system-ui, sans-serif',
    borderRadius: "0.75rem",
  },
} as const;

export function AuthPage({ mode }: { mode: "sign-in" | "sign-up" }) {
  return (
    <div className="flex min-h-dvh">
      {/* Left — editorial black panel */}
      <div className="relative hidden flex-1 flex-col justify-between overflow-hidden bg-black p-12 lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.06] mix-blend-screen"
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /></filter><rect width='100%25' height='100%25' filter='url(%23n)' /></svg>\")",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease }}
          className="flex items-center gap-2.5"
        >
          <motion.span
            className="inline-block h-2 w-2 rounded-full bg-white"
            animate={{ scale: [1, 1.4, 1] }}
            transition={{ duration: 1.8, repeat: Infinity }}
          />
          <span className="font-display text-2xl font-semibold tracking-tight text-white">
            sayso
          </span>
        </motion.div>

        <div>
          <h1 className="font-display font-semibold leading-[0.9] tracking-[-0.03em] text-white text-[min(8vw,7rem)]">
            <div className="overflow-hidden">
              <motion.div
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 1, ease, delay: 0.2 }}
              >
                Forms
              </motion.div>
            </div>
            <div className="overflow-hidden">
              <motion.div
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 1, ease, delay: 0.35 }}
              >
                that
              </motion.div>
            </div>
            <div className="overflow-hidden">
              <motion.em
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 1, ease, delay: 0.5 }}
                className="block italic text-white/70"
              >
                listen.
              </motion.em>
            </div>
          </h1>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, ease, delay: 0.8 }}
          >
            <Waveform bars={36} className="mt-10 h-8 text-white/20" />
          </motion.div>
        </div>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease, delay: 0.6 }}
          className="text-[10px] uppercase tracking-[0.28em] text-white/40"
        >
          &#167; the voice is the form
        </motion.p>
      </div>

      {/* Right — auth form */}
      <div className="flex flex-1 items-center justify-center bg-white px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease, delay: 0.3 }}
          className="w-full max-w-[400px]"
        >
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <motion.span
              className="inline-block h-2 w-2 rounded-full bg-black"
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 1.8, repeat: Infinity }}
            />
            <span className="font-display text-2xl font-semibold tracking-tight">
              sayso
            </span>
          </div>

          {mode === "sign-in" ? (
            <SignIn
              routing="path"
              path="/sign-in"
              appearance={clerkAppearance}
            />
          ) : (
            <SignUp
              routing="path"
              path="/sign-up"
              appearance={clerkAppearance}
            />
          )}
        </motion.div>
      </div>
    </div>
  );
}
