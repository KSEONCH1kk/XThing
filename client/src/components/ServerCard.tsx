import { motion } from "framer-motion";
import type { Server } from "../types";
import { flagEmoji } from "../lib/format";

interface Props {
  server: Server;
  selected?: boolean;
  onClick?: () => void;
}

export function ServerCard({ server, selected, onClick }: Props) {
  const intensity = 0.3 + (server.loadPercent / 100) * 0.6;
  return (
    <motion.button
      onClick={onClick}
      whileHover={{ y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 26 }}
      className={[
        "w-full text-left p-4 rounded-card bg-bg-card border transition-all duration-200",
        selected ? "border-ink-0 shadow-glow" : "border-line hover:border-line-strong",
      ].join(" ")}
    >
      <div className="flex items-center gap-3">
        <div className="text-[26px] leading-none grayscale">{flagEmoji(server.countryCode)}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-medium text-ink-0 truncate">{server.name}</span>
            <span className="text-[10px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border border-line text-ink-2">
              {server.protocol}
            </span>
          </div>
          <div className="text-[12px] text-ink-2 mt-0.5">
            {server.city}
            {typeof server.pingMs === "number" ? <> · {server.pingMs} ms</> : null}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1">
          <div className="text-[11px] text-ink-2">Нагрузка</div>
          <div className="flex items-center gap-1.5">
            <div className="w-16 h-1.5 rounded-full bg-ink-0/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${server.loadPercent}%`,
                  backgroundColor: `rgba(255,255,255,${intensity})`,
                  boxShadow: `0 0 8px rgba(255,255,255,${intensity * 0.4})`,
                }}
              />
            </div>
            <span className="text-[11px] text-ink-2 w-8 text-right tabular-nums">
              {server.loadPercent}%
            </span>
          </div>
        </div>
      </div>
    </motion.button>
  );
}
