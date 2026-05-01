import { AnimatePresence, motion } from "framer-motion";
import { useToast } from "../store/toast";
import { isCapacitor } from "../lib/platform";

// Монохромная типизация: различаем бордером и иконкой, не цветом.
const meta = {
  success: { icon: <CheckIcon />, ring: "border-ink-0/60" },
  error: { icon: <CrossIcon />, ring: "border-ink-0 [border-style:dashed]" },
  info: { icon: <DotIcon />, ring: "border-line-strong" },
} as const;

export function XToastHost() {
  const items = useToast((s) => s.items);
  const dismiss = useToast((s) => s.dismiss);
  const fromBottom = isCapacitor;

  return (
    <div
      // bottom-24 = 96px — выше нижней панели табов на десктопе и Capacitor.
      className="fixed left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 px-3 w-full max-w-md pointer-events-none bottom-24"
    >
      <AnimatePresence>
        {items.map((t) => {
          const m = meta[t.kind];
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              onClick={() => dismiss(t.id)}
              className={[
                "pointer-events-auto cursor-pointer flex items-start gap-3",
                "bg-bg-secondary/95 backdrop-blur border rounded-card px-4 py-3 shadow-glow",
                m.ring,
              ].join(" ")}
            >
              <div className="mt-0.5 text-ink-0">{m.icon}</div>
              <div className="flex-1 min-w-0">
                <div className="text-[14px] font-medium text-ink-0">{t.title}</div>
                {t.message ? (
                  <div className="text-[12px] text-ink-2 mt-0.5">{t.message}</div>
                ) : null}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 9.5l2.5 2.5L13 7" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function CrossIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 6l6 6M12 6l-6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
function DotIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="8" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="9" cy="9" r="2.2" fill="currentColor" />
    </svg>
  );
}
