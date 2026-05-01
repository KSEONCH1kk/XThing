import { motion } from "framer-motion";

interface Props {
  data: number[];
  height?: number;
  /** Внутренняя ширина viewBox. SVG растягивается до 100% ширины контейнера. */
  width?: number;
  fill?: boolean;
  thickness?: number;
  /** Если true — фиксированная пиксельная ширина (не растягивается). По умолчанию false: SVG fluid. */
  fixed?: boolean;
}

export function XSparkline({
  data,
  height = 60,
  width = 600,
  fill = true,
  thickness = 1.5,
  fixed = false,
}: Props) {
  const w = width;
  const h = height;
  const padTop = 4;
  const padBot = 2;
  const svgWidth = fixed ? w : "100%";

  if (data.length < 2) {
    return (
      <svg
        width={svgWidth}
        height={h}
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="block"
      >
        <line
          x1="0"
          y1={h - padBot}
          x2={w}
          y2={h - padBot}
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="1"
        />
      </svg>
    );
  }
  const max = Math.max(...data, 1);
  const xs = data.map((_, i) => (i / (data.length - 1)) * w);
  const ys = data.map((v) => h - padBot - (v / max) * (h - padTop - padBot));
  const points = xs.map((x, i) => `${x.toFixed(1)},${ys[i]!.toFixed(1)}`);
  const linePath = `M ${points.join(" L ")}`;
  const fillPath = `${linePath} L ${w},${h} L 0,${h} Z`;

  return (
    <svg
      width={svgWidth}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="block"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.32)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
      </defs>
      {fill ? (
        <motion.path
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          d={fillPath}
          fill="url(#spark-fill)"
        />
      ) : null}
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        d={linePath}
        fill="none"
        stroke="#ffffff"
        strokeWidth={thickness}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
