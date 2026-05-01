import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: number;
}

export function XPopup({ open, onClose, title, children, width = 420 }: Props) {
  // Wrapper всегда в DOM — состояние управляется через animate, который
  // реагирует на ТЕКУЩИЙ open. pointerEvents переключается дискретно (без
  // transition), opacity и scale плавно. Это устраняет «залипание»
  // backdrop'а после закрытия — клики проходят сквозь сразу при open=false.
  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={false}
      animate={{
        opacity: open ? 1 : 0,
        pointerEvents: open ? "auto" : "none",
      }}
      transition={{ opacity: { duration: 0.15 } }}
    >
      <div onClick={onClose} className="absolute inset-0 bg-black/70 backdrop-blur-md" />

      <motion.div
        animate={{ scale: open ? 1 : 0.92 }}
        transition={{ type: "spring", stiffness: 320, damping: 26 }}
        className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none"
      >
        <div
          style={{ width }}
          // КЛЮЧЕВОЕ: pointer-events на боксе тоже переключаются по open.
          // CSS pointer-events:auto у child переопределяет parent-овский none,
          // поэтому невидимый попап-бокс продолжал ловить клики и блокировал
          // элементы под ним (особенно заметно на длинных формах админки).
          className={[
            open ? "pointer-events-auto" : "pointer-events-none",
            "bg-bg-secondary border border-line rounded-modal p-5 shadow-card max-w-full",
          ].join(" ")}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-3">
            {title ? (
              <h3 className="text-[18px] font-semibold text-ink-0 tracking-tight">{title}</h3>
            ) : (
              <span />
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 grid place-items-center rounded-full text-ink-2 hover:text-ink-0 hover:bg-ink-0/5"
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
          {children}
        </div>
      </motion.div>
    </motion.div>
  );
}
