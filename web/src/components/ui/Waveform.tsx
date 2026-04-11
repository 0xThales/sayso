import { motion } from "framer-motion";

export function Waveform({
  active = true,
  bars = 24,
  className = "",
}: {
  active?: boolean;
  bars?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-end gap-1 ${className}`}>
      {Array.from({ length: bars }).map((_, i) => (
        <motion.span
          key={i}
          className="w-1 rounded-full bg-current"
          animate={
            active ? { scaleY: [0.3, 1, 0.5, 0.9, 0.3] } : { scaleY: 0.2 }
          }
          transition={{
            duration: 1.4,
            repeat: active ? Infinity : 0,
            delay: i * 0.04,
            ease: "easeInOut",
          }}
          style={{ height: "100%", transformOrigin: "bottom" }}
        />
      ))}
    </div>
  );
}
