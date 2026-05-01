import { motion } from "framer-motion";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { PageHeader } from "../components/PageHeader";
import { useT } from "../lib/i18n";

interface Props {
  onBack: () => void;
  onOpenRouting: () => void;
}

export function SettingsScreen({ onBack, onOpenRouting }: Props) {
  const t = useT();

  return (
    <div className="flex flex-col gap-4 p-5 max-w-2xl mx-auto">
      <PageHeader>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="w-9 h-9 grid place-items-center rounded-full bg-bg-card border border-line hover:border-line-strong"
            aria-label={t("common.back")}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <div>
            <div className="text-[11px] text-ink-2 uppercase tracking-[0.1em]">{t("tab.profile")}</div>
            <h2 className="text-[22px] font-semibold tracking-tight">{t("settings.title")}</h2>
          </div>
        </div>
      </PageHeader>

      <LanguageSwitcher />

      <NavRow
        title={t("settings.routing")}
        desc={t("settings.routingDesc")}
        onClick={onOpenRouting}
        icon={<RoutingIcon />}
      />

      <section className="bg-bg-card border border-line rounded-card p-5">
        <div className="text-[11px] text-ink-2 uppercase tracking-[0.1em] mb-1">{t("settings.about")}</div>
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-ink-1">XThing VPN</span>
          <span className="text-[12px] text-ink-2 font-mono">{t("settings.version")} 1.0.0</span>
        </div>
      </section>
    </div>
  );
}

function NavRow({
  title,
  desc,
  onClick,
  icon,
}: {
  title: string;
  desc: string;
  onClick: () => void;
  icon: React.ReactNode;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="bg-bg-card border border-line rounded-card p-4 flex items-center justify-between hover:border-line-strong transition-colors text-left no-select"
    >
      <div className="flex items-center gap-3">
        <span className="w-9 h-9 grid place-items-center rounded-full border border-line text-ink-1">
          {icon}
        </span>
        <div>
          <div className="text-[14px] font-medium text-ink-0">{title}</div>
          <div className="text-[11px] text-ink-2">{desc}</div>
        </div>
      </div>
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="text-ink-2">
        <path
          d="M5 3l5 4-5 4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.button>
  );
}

function RoutingIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="3" cy="3" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="13" cy="3" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <circle cx="8" cy="13" r="1.6" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M3 4.5v3a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-3"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
      />
      <path d="M8 9.5v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
