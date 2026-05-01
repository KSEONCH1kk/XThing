import { motion } from "framer-motion";
import { useT } from "../lib/i18n";

export type Tab = "main" | "servers" | "profile" | "admin";

interface Props {
  active: Tab;
  onChange: (t: Tab) => void;
  showAdmin?: boolean;
}

const allTabs: { id: Tab; tKey: string; icon: (active: boolean) => JSX.Element }[] = [
  {
    id: "main",
    tKey: "tab.main",
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3l8 6v10a2 2 0 0 1-2 2h-4v-6h-4v6H6a2 2 0 0 1-2-2V9l8-6z"
          stroke={a ? "#fff" : "rgba(255,255,255,0.42)"}
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    id: "servers",
    tKey: "tab.servers",
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="4" width="18" height="6" rx="2" stroke={a ? "#fff" : "rgba(255,255,255,0.42)"} strokeWidth="1.8" />
        <rect x="3" y="14" width="18" height="6" rx="2" stroke={a ? "#fff" : "rgba(255,255,255,0.42)"} strokeWidth="1.8" />
        <circle cx="7" cy="7" r="1" fill={a ? "#fff" : "rgba(255,255,255,0.42)"} />
        <circle cx="7" cy="17" r="1" fill={a ? "#fff" : "rgba(255,255,255,0.42)"} />
      </svg>
    ),
  },
  {
    id: "profile",
    tKey: "tab.profile",
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="8" r="4" stroke={a ? "#fff" : "rgba(255,255,255,0.42)"} strokeWidth="1.8" />
        <path d="M4 20c1.5-4 5-6 8-6s6.5 2 8 6" stroke={a ? "#fff" : "rgba(255,255,255,0.42)"} strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "admin",
    tKey: "tab.admin",
    icon: (a) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
        <path d="M12 3l9 4v6c0 5-4 8-9 8s-9-3-9-8V7l9-4z" stroke={a ? "#fff" : "rgba(255,255,255,0.42)"} strokeWidth="1.7" />
        <path d="M12 9v4M9 11h6" stroke={a ? "#fff" : "rgba(255,255,255,0.42)"} strokeWidth="1.7" strokeLinecap="round" />
      </svg>
    ),
  },
];

export function BottomTabs({ active, onChange, showAdmin }: Props) {
  const t = useT();
  const tabs = showAdmin ? allTabs : allTabs.filter((tab) => tab.id !== "admin");
  const activeIndex = Math.max(
    0,
    tabs.findIndex((tab) => tab.id === active)
  );
  const cellPct = 100 / tabs.length;

  return (
    <nav className="relative z-30 bg-bg-secondary/80 backdrop-blur border-t border-line shrink-0">
      <div className="max-w-md mx-auto px-2 py-2 pb-[max(8px,env(safe-area-inset-bottom))]">
        {/* Внутренний relative-контейнер БЕЗ padding'а: % индикатора
            считаются от его padding-box, а grid-ячейки тоже занимают всю
            эту ширину один-в-один. Иначе % индикатора отсчитывается от
            padded box внешнего контейнера и ячейки сдвинуты — возникает
            кривая центровка. */}
        <div
          className="relative grid"
          style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
        >
          <motion.span
            className="absolute inset-y-0 rounded-card bg-ink-0/[0.07] border border-line-strong pointer-events-none"
            initial={false}
            animate={{ left: `calc(${activeIndex * cellPct}% + 4px)` }}
            transition={{ type: "spring", stiffness: 380, damping: 30 }}
            style={{ width: `calc(${cellPct}% - 8px)` }}
          />

          {tabs.map((tab) => {
            const isActive = active === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onChange(tab.id)}
                className="relative z-10 flex flex-col items-center justify-center gap-1 py-1.5 rounded-card no-select"
              >
                <span>{tab.icon(isActive)}</span>
                <span
                  className={[
                    "text-[11px] transition-colors",
                    isActive ? "text-ink-0" : "text-ink-2",
                  ].join(" ")}
                >
                  {t(tab.tKey)}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
