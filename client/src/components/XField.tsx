import { useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { motion } from "framer-motion";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  label: string;
  error?: string | null;
  rightSlot?: ReactNode;
}

export function XField({ label, error, rightSlot, value, onFocus, onBlur, placeholder, ...rest }: Props) {
  const id = useId();
  const [focused, setFocused] = useState(false);
  const filled = !!(value !== undefined && value !== "");
  const float = focused || filled;
  // Показываем placeholder ТОЛЬКО когда label уплыл наверх — иначе они
  // перекрывают друг друга в центре поля.
  const effectivePlaceholder = float ? placeholder : undefined;

  return (
    <div className="w-full">
      <motion.div
        animate={error ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className={[
          "relative bg-bg-card rounded-field transition-colors duration-200",
          "border",
          error
            ? "border-ink-0 ring-1 ring-ink-0/40"
            : focused
            ? "border-ink-0/60"
            : "border-line",
        ].join(" ")}
      >
        <label
          htmlFor={id}
          className={[
            "absolute left-3 pointer-events-none transition-all duration-200 origin-left",
            float ? "top-1.5 text-[11px] text-ink-2" : "top-1/2 -translate-y-1/2 text-[14px] text-ink-2",
          ].join(" ")}
        >
          {label}
        </label>

        <input
          id={id}
          value={value as any}
          placeholder={effectivePlaceholder}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          className={[
            "w-full bg-transparent outline-none text-[15px] text-ink-0 caret-ink-0",
            "placeholder:text-ink-3",
            "px-3 pt-5 pb-2 rounded-field",
            rightSlot ? "pr-10" : "",
          ].join(" ")}
        />
        {rightSlot ? (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center">
            {rightSlot}
          </div>
        ) : null}
      </motion.div>
      {error ? (
        <motion.div
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[12px] text-ink-1 mt-1.5 px-1 flex items-center gap-1.5"
        >
          <ErrorDot /> {error}
        </motion.div>
      ) : null}
    </div>
  );
}

function ErrorDot() {
  return (
    <span className="inline-block w-1.5 h-1.5 rounded-full bg-ink-0" />
  );
}
