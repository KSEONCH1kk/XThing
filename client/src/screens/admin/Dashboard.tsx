import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Admin, type AdminStats } from "../../api/admin";
import { XSparkline } from "../../components/XSparkline";
import { formatBytes } from "../../lib/format";
import { useT } from "../../lib/i18n";

export function Dashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const t = useT();

  useEffect(() => {
    Admin.stats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-ink-2 text-[13px] py-8 text-center">{t("common.loading")}</div>;
  if (!stats) return <div className="text-ink-2 text-[13px] py-8 text-center">{t("admin.dash.noData")}</div>;

  const series = stats.sparkline;
  const upArr = series.map((s) => s.up);
  const downArr = series.map((s) => s.down);
  const totalArr = series.map((s) => s.up + s.down);

  return (
    <div className="flex flex-col gap-3">
      {/* 4 плитки в одну строку */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Tile label={t("admin.dash.users")} value={stats.users.toString()} />
        <Tile label={t("admin.dash.activeSubs")} value={stats.activeSubs.toString()} />
        <Tile
          label={t("admin.dash.keys")}
          value={`${stats.keys.used} / ${stats.keys.total}`}
          hint={t("admin.dash.usedHint")}
        />
        <Tile label={t("admin.dash.servers")} value={stats.servers.toString()} />
      </div>

      {/* Главная карточка трафика — заголовок слева, спарклайн занимает оставшееся справа */}
      <div className="bg-bg-card border border-line rounded-card p-4 flex items-center gap-5">
        <div className="shrink-0 min-w-[110px]">
          <div className="text-[11px] text-ink-2 uppercase tracking-[0.1em]">{t("admin.dash.traffic14d")}</div>
          <div className="text-[20px] font-semibold mt-0.5 tabular-nums whitespace-nowrap">
            {formatBytes(stats.traffic.up + stats.traffic.down)}
          </div>
        </div>
        <div className="flex-1 min-w-0">
          <XSparkline data={totalArr} height={70} />
        </div>
      </div>

      {/* Download / Upload — компактные ряды с inline спарклайнами */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-bg-card border border-line rounded-card p-4 flex items-center gap-4">
          <div className="shrink-0">
            <div className="text-[11px] text-ink-2 uppercase tracking-[0.1em]">{t("admin.dash.download")}</div>
            <div className="text-[16px] font-semibold mt-0.5 tabular-nums whitespace-nowrap">
              {formatBytes(stats.traffic.down)}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <XSparkline data={downArr} height={48} />
          </div>
        </div>
        <div className="bg-bg-card border border-line rounded-card p-4 flex items-center gap-4">
          <div className="shrink-0">
            <div className="text-[11px] text-ink-2 uppercase tracking-[0.1em]">{t("admin.dash.upload")}</div>
            <div className="text-[16px] font-semibold mt-0.5 tabular-nums whitespace-nowrap">
              {formatBytes(stats.traffic.up)}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <XSparkline data={upArr} height={48} />
          </div>
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-bg-card border border-line rounded-card p-3"
    >
      <div className="text-[10px] text-ink-2 uppercase tracking-[0.1em] truncate">{label}</div>
      <div className="text-[20px] font-semibold mt-0.5 tabular-nums">{value}</div>
      {hint ? <div className="text-[10px] text-ink-2 mt-0.5">{hint}</div> : null}
    </motion.div>
  );
}
