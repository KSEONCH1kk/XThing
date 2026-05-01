import { motion } from "framer-motion";
import { formatBytes } from "../lib/format";
import { useT } from "../lib/i18n";

interface Props {
  used: number;
  limit: number | null;
  compact?: boolean;
}

export function TrafficBar({ used, limit, compact }: Props) {
  const t = useT();
  const unlimited = limit === null;
  const ratio = unlimited ? 0 : Math.min(1, used / Math.max(1, limit!));
  const pct = ratio * 100;
  const intensity = unlimited ? 0.8 : 0.4 + 0.6 * Math.min(1, pct / 100);
  const danger = !unlimited && pct >= 90;

  return (
    <div className={compact ? "" : "w-full"}>
      <div className="flex items-center justify-between text-[12px] text-ink-2 mb-1.5">
        <span>{unlimited ? t("common.unlimited") : `${formatBytes(used)} / ${formatBytes(limit!)}`}</span>
        {!unlimited ? <span className="tabular-nums">{Math.round(pct)}%</span> : null}
      </div>
      <div
        className={[
          "relative h-2 rounded-full overflow-hidden",
          danger ? "bg-ink-0/10 [outline:1px_dashed_rgba(255,255,255,0.4)] [outline-offset:-1px]" : "bg-ink-0/[0.06]",
        ].join(" ")}
      >
        <motion.div
          initial={false}
          animate={{
            width: unlimited ? "100%" : `${Math.max(2, pct)}%`,
            backgroundColor: `rgba(255,255,255,${intensity})`,
          }}
          transition={{ type: "spring", stiffness: 120, damping: 22 }}
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ boxShadow: `0 0 12px rgba(255,255,255,${intensity * 0.4})` }}
        />
      </div>
    </div>
  );
}
