import { motion, type HTMLMotionProps } from "framer-motion";
import type { ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

interface Props extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: Variant;
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

// Монохром: первичная — белая кнопка с чёрным текстом, остальные — нюансы обводки/прозрачности.
const variantClasses: Record<Variant, string> = {
  primary:
    "text-black bg-ink-0 hover:bg-ink-1 active:bg-ink-1",
  secondary:
    "text-ink-0 bg-bg-card border border-line hover:border-line-bright",
  danger:
    "text-ink-0 bg-transparent border border-ink-0/60 hover:bg-ink-0/5 [border-style:dashed]",
  ghost:
    "text-ink-2 hover:text-ink-0 hover:bg-ink-0/5",
};

export function XButton({
  variant = "primary",
  loading = false,
  disabled,
  fullWidth,
  children,
  className,
  ...rest
}: Props) {
  const isDisabled = disabled || loading;
  return (
    <motion.button
      whileHover={isDisabled ? undefined : { scale: 1.015 }}
      whileTap={isDisabled ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 400, damping: 22 }}
      disabled={isDisabled}
      className={[
        "relative inline-flex items-center justify-center gap-2",
        "h-11 px-5 rounded-field text-[14px] font-medium tracking-tight",
        "transition-[background-color,border-color,opacity,filter] duration-150",
        fullWidth ? "w-full" : "",
        variantClasses[variant],
        isDisabled ? "opacity-40 pointer-events-none" : "",
        className || "",
      ].join(" ")}
      {...rest}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <Spinner inverted={variant === "primary"} />
          <span className="opacity-70">Загрузка…</span>
        </span>
      ) : (
        children
      )}
    </motion.button>
  );
}

function Spinner({ inverted }: { inverted?: boolean }) {
  const c = inverted ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.85)";
  const c2 = inverted ? "rgba(0,0,0,0.2)" : "rgba(255,255,255,0.2)";
  return (
    <svg className="ring-spin" width="16" height="16" viewBox="0 0 16 16">
      <circle cx="8" cy="8" r="6" stroke={c2} strokeWidth="2" fill="none" />
      <path d="M14 8a6 6 0 0 0-6-6" stroke={c} strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}
