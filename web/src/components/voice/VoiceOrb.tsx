import { motion } from "framer-motion";

export function VoiceOrb({
  status,
  isSpeaking,
  isListening,
  onClick,
  disabled,
}: {
  status: string;
  isSpeaking: boolean;
  isListening: boolean;
  onClick: () => void;
  disabled: boolean;
}) {
  const idle = status === "disconnected";
  const connecting = status === "connecting";
  const active = status === "connected";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="relative flex items-center justify-center disabled:cursor-not-allowed"
    >
      {/* Outer radiating ring 3 */}
      <motion.div
        className="absolute h-48 w-48 rounded-full border border-black/10"
        animate={
          active
            ? { scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }
            : { scale: 1, opacity: 0 }
        }
        transition={{ duration: 3, repeat: Infinity, ease: "easeOut" }}
      />
      {/* Outer radiating ring 2 */}
      <motion.div
        className="absolute h-40 w-40 rounded-full border border-black/15"
        animate={
          active
            ? { scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }
            : { scale: 1, opacity: 0 }
        }
        transition={{
          duration: 3,
          delay: 0.5,
          repeat: Infinity,
          ease: "easeOut",
        }}
      />
      {/* Outer radiating ring 1 */}
      <motion.div
        className="absolute h-32 w-32 rounded-full border border-black/20"
        animate={
          active
            ? { scale: [1, 1.2, 1], opacity: [0.6, 0, 0.6] }
            : connecting
              ? { scale: [1, 1.15, 1], opacity: [0.3, 0.15, 0.3] }
              : { scale: 1, opacity: 0 }
        }
        transition={{
          duration: connecting ? 1.5 : 3,
          delay: 1,
          repeat: Infinity,
          ease: "easeOut",
        }}
      />

      {/* Speaking halo */}
      <motion.div
        className="absolute h-28 w-28 rounded-full bg-black/5"
        animate={
          isSpeaking
            ? { scale: [1, 1.15, 1] }
            : isListening
              ? { scale: [1, 1.05, 1] }
              : { scale: 1 }
        }
        transition={{
          duration: isSpeaking ? 0.8 : 1.4,
          repeat: isSpeaking || isListening ? Infinity : 0,
          ease: "easeInOut",
        }}
      />

      {/* Main orb */}
      <motion.div
        className="relative z-10 flex h-24 w-24 items-center justify-center rounded-full bg-black shadow-[0_16px_48px_rgba(0,0,0,0.25)]"
        whileHover={idle ? { scale: 1.05 } : {}}
        whileTap={idle ? { scale: 0.96 } : {}}
        animate={
          isSpeaking
            ? { scale: [1, 1.08, 1] }
            : { scale: 1 }
        }
        transition={
          isSpeaking
            ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" }
            : { duration: 0.3 }
        }
      >
        {idle && (
          <svg
            className="ml-1 h-8 w-8 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        )}
        {connecting && (
          <motion.div
            className="h-5 w-5 rounded-full border-2 border-white border-t-transparent"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        )}
        {active && (
          <div className="flex items-end gap-1">
            {Array.from({ length: 4 }).map((_, i) => (
              <motion.span
                key={i}
                className="w-1 rounded-full bg-white"
                animate={
                  isSpeaking
                    ? { scaleY: [0.4, 1.2, 0.6, 1, 0.4] }
                    : isListening
                      ? { scaleY: [0.3, 0.6, 0.4, 0.5, 0.3] }
                      : { scaleY: 0.3 }
                }
                transition={{
                  duration: isSpeaking ? 0.7 : 1.4,
                  repeat: Infinity,
                  delay: i * 0.08,
                  ease: "easeInOut",
                }}
                style={{ height: "20px", transformOrigin: "bottom" }}
              />
            ))}
          </div>
        )}
      </motion.div>
    </button>
  );
}
