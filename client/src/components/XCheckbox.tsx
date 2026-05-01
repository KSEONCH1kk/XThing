import { motion } from "framer-motion";
import { useId } from "react";

interface Props {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function XCheckbox({ checked, onChange, label, disabled }: Props) {
  const id = useId();
  return (
    <label
      htmlFor={id}
      className={[
        "inline-flex items-center gap-2.5 cursor-pointer no-select",
        disabled ? "opacity-50 pointer-events-none" : "",
      ].join(" ")}
    >
      <span className="relative">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only"
        />
        <motion.span
          animate={{
            backgroundColor: checked ? "#ffffff" : "rgba(255,255,255,0.04)",
            borderColor: checked ? "#ffffff" : "rgba(255,255,255,0.24)",
          }}
          transition={{ duration: 0.18 }}
          className="block w-5 h-5 rounded-md border"
        >
          <svg viewBox="0 0 20 20" className="w-5 h-5 absolute inset-0">
            <motion.path
              d="M4 10.5l4 4L16 6"
              fill="none"
              stroke="#000"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={false}
              animate={{ pathLength: checked ? 1 : 0, opacity: checked ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            />
          </svg>
        </motion.span>
      </span>
      {label ? <span className="text-[14px] text-ink-0">{label}</span> : null}
    </label>
  );
}
