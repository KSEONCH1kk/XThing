import { motion } from "framer-motion";
import { useId } from "react";

interface Option<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
}

interface Props<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: Option<T>[];
  fullWidth?: boolean;
  size?: "sm" | "md";
}

export function XSegmented<T extends string>({
  value,
  onChange,
  options,
  fullWidth,
  size = "md",
}: Props<T>) {
  const groupId = useId();
  const h = size === "sm" ? "h-8" : "h-10";
  const text = size === "sm" ? "text-[12px]" : "text-[13px]";
  return (
    <div
      className={[
        "relative inline-flex p-1 rounded-full bg-bg-card border border-line",
        fullWidth ? "w-full" : "",
      ].join(" ")}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange(o.value)}
            className={[
              "relative z-10 flex items-center justify-center gap-1.5 px-4 rounded-full transition-colors",
              h,
              text,
              fullWidth ? "flex-1" : "",
              active ? "text-black" : "text-ink-2 hover:text-ink-0",
            ].join(" ")}
          >
            {active ? (
              <motion.span
                layoutId={`seg-${groupId}`}
                className="absolute inset-0 bg-ink-0 rounded-full"
                transition={{ type: "spring", stiffness: 500, damping: 32 }}
              />
            ) : null}
            <span className="relative flex items-center gap-1.5">
              {o.icon}
              {o.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
