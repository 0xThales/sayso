import { motion } from "framer-motion";

export function LoadingDots() {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: 3 }).map((_, i) => (
        <motion.span
          key={i}
          className="h-1.5 w-1.5 rounded-full bg-black"
          animate={{ opacity: [0.15, 1, 0.15] }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            delay: i * 0.2,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
