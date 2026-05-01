import { AnimatePresence, motion } from "framer-motion";
import { useId, useState, type InputHTMLAttributes } from "react";

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  label: string;
  error?: string | null;
}

/**
 * Поле пароля с посимвольным раскрытием/скрытием.
 *
 * Под капотом:
 *  - реальный <input type="text"> с прозрачным цветом текста (видим только caret)
 *  - сверху overlay с motion.span на каждый символ
 *  - при переключении revealed каждый символ через AnimatePresence
 *    плавно меняется (opacity + y + blur) с stagger по индексу — получается
 *    эффект «волны раскрытия» слева направо
 */
export function XPasswordField({
  label,
  error,
  value,
  onChange,
  onFocus,
  onBlur,
  ...rest
}: Props) {
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const [focused, setFocused] = useState(false);
  const v = String(value ?? "");
  const filled = v.length > 0;
  const float = focused || filled;

  return (
    <div className="w-full">
      <motion.div
        animate={error ? { x: [0, -6, 6, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.4 }}
        className={[
          "relative bg-bg-card rounded-field transition-colors duration-200 border",
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
            "absolute left-3 pointer-events-none transition-all duration-200 origin-left z-10",
            float
              ? "top-1.5 text-[11px] text-ink-2"
              : "top-1/2 -translate-y-1/2 text-[14px] text-ink-2",
          ].join(" ")}
        >
          {label}
        </label>

        {/* Overlay-слой с символами — рисует то, что видит пользователь */}
        <div className="absolute inset-0 px-3 pt-5 pb-2 pr-10 pointer-events-none flex items-center overflow-hidden">
          <div className="text-[15px] text-ink-0 font-mono tracking-[0.04em] flex flex-nowrap">
            {v.split("").map((c, i) => (
              <span key={i} className="inline-block relative" style={{ minWidth: "0.6em" }}>
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={revealed ? `r${c}` : "h"}
                    initial={{ opacity: 0, y: 6, filter: "blur(3px)" }}
                    animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                    exit={{ opacity: 0, y: -6, filter: "blur(3px)" }}
                    transition={{ duration: 0.22, delay: Math.min(i, 18) * 0.025 }}
                    className="inline-block"
                  >
                    {revealed ? (c === " " ? " " : c) : "•"}
                  </motion.span>
                </AnimatePresence>
              </span>
            ))}
          </div>
        </div>

        {/* Реальный input — невидимый текст, видимый caret */}
        <input
          id={id}
          type="text"
          value={value}
          onChange={onChange}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="current-password"
          {...rest}
          className="w-full bg-transparent outline-none text-[15px] px-3 pt-5 pb-2 pr-10 rounded-field font-mono tracking-[0.04em] selection:bg-ink-0/20"
          style={{ color: "transparent", caretColor: "#fff" }}
        />

        {/* Кнопка глаза */}
        <button
          type="button"
          onClick={() => setRevealed((r) => !r)}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 grid place-items-center text-ink-2 hover:text-ink-0 transition-colors z-10"
          aria-label={revealed ? "Скрыть пароль" : "Показать пароль"}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={revealed ? "off" : "on"}
              initial={{ opacity: 0, scale: 0.8, rotate: -10 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              exit={{ opacity: 0, scale: 0.8, rotate: 10 }}
              transition={{ duration: 0.15 }}
            >
              {revealed ? <EyeOff /> : <Eye />}
            </motion.span>
          </AnimatePresence>
        </button>
      </motion.div>
      {error ? (
        <motion.div
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[12px] text-ink-1 mt-1.5 px-1 flex items-center gap-1.5"
        >
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-ink-0" /> {error}
        </motion.div>
      ) : null}
    </div>
  );
}

function Eye() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
function EyeOff() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path
        d="M10.6 6.2A10 10 0 0 1 12 6c6.5 0 10 6 10 6a18 18 0 0 1-3.2 4M6.4 7.6A18 18 0 0 0 2 12s3.5 6 10 6c1.6 0 3-.3 4.2-.8"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
}
