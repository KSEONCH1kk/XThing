import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface StageProps {
  pageKey: string;
  children: ReactNode;
  duration?: number;
}

/**
 * Переключение экранов с приятной анимацией ВХОДА — БЕЗ AnimatePresence.
 *
 * Принцип: при смене pageKey React видит новый key → мгновенно размонтирует
 * старый motion.div → монтирует новый → новый играет initial → animate.
 * Старого больше нет в DOM, поэтому его клики/ховеры/выделения не могут
 * перебить новый экран. Никаких overlap-багов в принципе.
 *
 * НИКОГДА не оборачивайте Stage в AnimatePresence — это вернёт проблему
 * с одновременным существованием двух экранов и перехватом кликов.
 *
 * Если нужна exit-анимация (например для модалок) — используйте отдельный
 * паттерн с AnimatePresence + ОБЯЗАТЕЛЬНО pointerEvents: "none" в exit
 * (см. XPopup.tsx — там wrapper всегда смонтирован, состояние через animate).
 */
export function Stage({ pageKey, children, duration = 0.18 }: StageProps) {
  return (
    <motion.div
      key={pageKey}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration }}
      className="min-h-full"
    >
      {children}
    </motion.div>
  );
}
