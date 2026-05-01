import { AnimatePresence, motion } from "framer-motion";
import { useI18n } from "../lib/i18n";

/**
 * Полноэкранная sweep-анимация при смене языка.
 * Белая панель въезжает справа, проходит экран и уходит — за это время
 * стор меняет lang, поэтому интерфейс обновляется «под покровом» свайпа.
 */
export function LangSweep() {
  const switching = useI18n((s) => s.switching);
  const lang = useI18n((s) => s.lang);
  return (
    <AnimatePresence>
      {switching ? (
        <motion.div
          key="sweep"
          initial={{ x: "-110%" }}
          animate={{ x: "0%" }}
          exit={{ x: "110%" }}
          transition={{ duration: 0.55, ease: [0.65, 0, 0.35, 1] }}
          className="fixed inset-0 z-[200] bg-ink-0 pointer-events-none flex items-center justify-center"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.18, duration: 0.18 }}
            className="text-black text-[64px] font-bold tracking-tight"
            style={{ fontFeatureSettings: "'ss01'" }}
          >
            {lang === "ru" ? "RU" : "EN"}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
