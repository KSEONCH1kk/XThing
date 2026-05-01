import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import type { VpnState } from "../types";
import { useT } from "../lib/i18n";

interface Props {
  state: VpnState;
  onPress: () => void;
  size?: number;
}

/**
 * Один и только один визуальный ring — это SVG-circle, центрированный.
 * Никакой CSS-border на button, иначе была двойная обводка с разным отступом
 * от рисованного кольца (CSS border снаружи box, SVG circle внутри радиуса).
 *
 * Для вращения четверти на SVG используем transformBox: "fill-box" +
 * transformOrigin: "center" — без этого CSS rotate в SVG крутится относительно
 * левого верхнего угла viewport'а, и арка не видна (улетает за край).
 */
export function ConnectButton({ state, onPress, size = 160 }: Props) {
  const t = useT();
  const cx = size / 2;
  const cy = size / 2;
  // Отступ от края кнопки до кольца. Достаточно, чтобы кольцо не касалось края.
  const ringPad = 8;
  const ringR = cx - ringPad;
  const circ = 2 * Math.PI * ringR;
  const arcLen = circ * 0.25; // ровно четверть
  const gapLen = circ - arcLen;

  const isActive = state === "connected";
  const isConnecting = state === "connecting";
  const isDisconnecting = state === "disconnecting";
  const isBusy = isConnecting || isDisconnecting;
  const isError = state === "error";

  // Цвет/толщина базового кольца зависит от состояния
  const baseStroke = isActive
    ? "rgba(255,255,255,0.95)"
    : isError
    ? "rgba(255,255,255,0.7)"
    : "rgba(255,255,255,0.22)";
  const baseWidth = isActive ? 2.5 : 1.6;

  // Ручное вращение четверти через нативный SVG transform-атрибут.
  // CSS-rotate на SVG-элементах непредсказуем (зависит от браузера, transform-box,
  // strokeDasharray и фазы луны), а SVG-атрибут rotate(angle cx cy) принимает
  // центр поворота явно — работает везде одинаково.
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    if (!isBusy) return;
    let raf = 0;
    let last = performance.now();
    const speed = 360 / 1000; // 360° за 1 секунду
    const dir = isDisconnecting ? -1 : 1;
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      setAngle((a) => (a + dir * speed * dt) % 360);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isBusy, isDisconnecting]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative" style={{ width: size, height: size }}>
        {/* Idle: мягкое пульсирующее свечение */}
        {state === "idle" ? (
          <motion.div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{ boxShadow: "0 0 60px rgba(255,255,255,0.12)" }}
            animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.9, 0.5] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
          />
        ) : null}

        {/* Connected: жёсткое свечение */}
        {isActive ? (
          <div
            className="absolute inset-0 rounded-full pointer-events-none"
            style={{
              boxShadow:
                "0 0 60px rgba(255,255,255,0.22), 0 0 120px rgba(255,255,255,0.08)",
            }}
          />
        ) : null}

        <motion.button
          onClick={onPress}
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 400, damping: 22 }}
          className="relative w-full h-full rounded-full grid place-items-center no-select cursor-pointer overflow-hidden"
          style={{
            background: isActive
              ? "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.10), rgba(255,255,255,0.02) 60%, #0a0a0a 100%)"
              : "radial-gradient(circle at 50% 35%, rgba(255,255,255,0.04), rgba(255,255,255,0.01) 70%, #0a0a0a 100%)",
            border: "none",
          }}
        >
          <svg
            width={size}
            height={size}
            viewBox={`0 0 ${size} ${size}`}
            className="absolute inset-0 pointer-events-none"
          >
            {/* Базовое кольцо — единственная граница */}
            <circle
              cx={cx}
              cy={cy}
              r={ringR}
              fill="none"
              stroke={baseStroke}
              strokeWidth={baseWidth}
              strokeDasharray={isError ? "4 5" : undefined}
            />

            {/* Connecting / Disconnecting: четверть крутится через
                SVG-атрибут transform — гарантированно работает в любом браузере. */}
            {isBusy ? (
              <g transform={`rotate(${angle} ${cx} ${cy})`}>
                <circle
                  cx={cx}
                  cy={cy}
                  r={ringR}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${arcLen} ${gapLen}`}
                  style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,0.45))" }}
                />
              </g>
            ) : null}

            {/* Connected: ring «дорисовывается». -90° чтобы старт был сверху. */}
            {isActive ? (
              <g transform={`rotate(-90 ${cx} ${cy})`}>
                <motion.circle
                  cx={cx}
                  cy={cy}
                  r={ringR}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={circ}
                  initial={{ strokeDashoffset: circ }}
                  animate={{ strokeDashoffset: 0 }}
                  transition={{ duration: 0.6, ease: "easeOut" }}
                />
              </g>
            ) : null}
          </svg>

          <AnimatePresence mode="wait">
            <motion.div
              key={state}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.18 }}
              className="relative z-10"
            >
              {isActive ? <ShieldIcon /> : isError ? <PowerIcon warn /> : <PowerIcon />}
            </motion.div>
          </AnimatePresence>
        </motion.button>
      </div>
      <div className="text-[13px] text-ink-2 tracking-[0.08em] uppercase">
        {t(`vpn.${state}`)}
      </div>
    </div>
  );
}

function PowerIcon({ warn }: { warn?: boolean } = {}) {
  return (
    <svg width="46" height="46" viewBox="0 0 48 48" fill="none">
      <path d="M24 8v15" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <path
        d="M14 16a14 14 0 1 0 20 0"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
      {warn ? <circle cx="38" cy="10" r="4" fill="#fff" /> : null}
    </svg>
  );
}

function ShieldIcon() {
  return (
    <svg width="46" height="46" viewBox="0 0 48 48" fill="none">
      <path
        d="M24 6l14 5v12c0 9-6 14-14 19-8-5-14-10-14-19V11l14-5z"
        stroke="#fff"
        strokeWidth="2.5"
        fill="rgba(255,255,255,0.06)"
      />
      <path
        d="M16 24l6 6 12-12"
        stroke="#fff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
