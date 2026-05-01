import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useT } from "../lib/i18n";

interface Props {
  onDone: () => void;
}

export function SplashScreen({ onDone }: Props) {
  const [progress, setProgress] = useState(0);
  const t = useT();
  // Стабилизируем ссылку на onDone, чтобы useEffect не пересоздавался при ре-рендерах App.
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const start = performance.now();
    let raf = 0;
    let doneTimer: number | undefined;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / 1600);
      setProgress(p);
      if (p < 1) raf = requestAnimationFrame(tick);
      else doneTimer = window.setTimeout(() => onDoneRef.current(), 250);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (doneTimer) clearTimeout(doneTimer);
    };
  }, []);

  const R = 56;
  const C = 2 * Math.PI * R;
  const offset = C * (1 - progress);

  return (
    <div className="fixed inset-0 bg-bg-primary grid place-items-center overflow-hidden z-50">
      <div className="relative flex flex-col items-center gap-6">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 18 }}
          className="relative grid place-items-center"
          style={{ width: 140, height: 140 }}
        >
          <svg width="140" height="140" viewBox="0 0 140 140" className="absolute inset-0 -rotate-90">
            <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <circle
              cx="70"
              cy="70"
              r={R}
              fill="none"
              stroke="#fff"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 50ms linear" }}
            />
          </svg>
          <div
            className="text-[44px] font-semibold tracking-tight text-ink-0"
            style={{ textShadow: "0 0 32px rgba(255,255,255,0.25)" }}
          >
            X
          </div>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-center"
        >
          <div className="text-[22px] font-semibold tracking-tight">XThing VPN</div>
          <div className="text-[12px] text-ink-2 mt-1 tracking-[0.08em] uppercase">{t("splash.subtitle")}</div>
        </motion.div>
      </div>
    </div>
  );
}
