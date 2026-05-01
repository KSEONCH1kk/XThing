import { motion } from "framer-motion";

interface Props {
  email: string;
  size?: number;
}

export function Avatar({ email, size = 64 }: Props) {
  const initials = email
    .split(/[@._-]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 280, damping: 22 }}
      style={{ width: size, height: size }}
      className="relative rounded-full grid place-items-center font-semibold text-ink-0 border border-line-strong bg-bg-card"
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          boxShadow: "inset 0 0 32px rgba(255,255,255,0.06), 0 0 16px rgba(255,255,255,0.05)",
        }}
      />
      <span className="relative tracking-tight" style={{ fontSize: size * 0.36 }}>
        {initials || "?"}
      </span>
    </motion.div>
  );
}
