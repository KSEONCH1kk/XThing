import { motion } from "framer-motion";

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  size?: "sm" | "md";
  disabled?: boolean;
  label?: string;
}

export function XSwitch({ checked, onChange, size = "md", disabled, label }: Props) {
  const w = size === "sm" ? 36 : 48;
  const h = size === "sm" ? 22 : 28;
  const pad = 3;
  const knob = h - pad * 2;
  const travel = w - knob - pad * 2;

  return (
    <label
      className={[
        "inline-flex items-center gap-2.5 cursor-pointer no-select",
        disabled ? "opacity-40 pointer-events-none" : "",
      ].join(" ")}
    >
      <motion.button
        type="button"
        onClick={() => onChange(!checked)}
        whileTap={{ scale: 0.96 }}
        animate={{
          backgroundColor: checked ? "#ffffff" : "rgba(255,255,255,0.08)",
          borderColor: checked ? "#ffffff" : "rgba(255,255,255,0.16)",
        }}
        transition={{ duration: 0.18 }}
        className="relative rounded-full border shrink-0"
        style={{ width: w, height: h }}
        aria-pressed={checked}
      >
        <motion.span
          animate={{
            x: checked ? travel : 0,
            backgroundColor: checked ? "#000000" : "#ffffff",
          }}
          transition={{ type: "spring", stiffness: 500, damping: 32 }}
          className="absolute rounded-full block"
          // Явно top:pad и left:pad — без percentage-translate, иначе
          // framer-motion `x` затирает tailwindовский translateY(-50%) и thumb уезжает.
          style={{
            width: knob,
            height: knob,
            top: pad,
            left: pad,
            boxShadow: checked ? "none" : "0 2px 6px rgba(0,0,0,0.4)",
          }}
        />
      </motion.button>
      {label ? <span className="text-[14px] text-ink-1">{label}</span> : null}
    </label>
  );
}
