import { useEffect, useState } from "react";
import { Admin, type AdminKey } from "../../api/admin";
import { XTable } from "../../components/XTable";
import { XButton } from "../../components/XButton";
import { XPopup } from "../../components/XPopup";
import { XSegmented } from "../../components/XSegmented";
import { useToast } from "../../store/toast";
import { formatDate } from "../../lib/format";
import { useT } from "../../lib/i18n";

const PLANS = [
  { value: "trial", label: "Trial" },
  { value: "basic", label: "Basic" },
  { value: "pro", label: "Pro" },
  { value: "unlimited", label: "Unlim" },
] as const;

export function KeysAdmin() {
  const [keys, setKeys] = useState<AdminKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [genOpen, setGenOpen] = useState(false);
  const [generated, setGenerated] = useState<string[] | null>(null);
  const [genPlan, setGenPlan] = useState<AdminKey["planId"]>("basic");
  const [genCount, setGenCount] = useState(1);
  const [busy, setBusy] = useState(false);
  const toast = useToast((s) => s.push);
  const t = useT();

  const load = () =>
    Admin.keys()
      .then(setKeys)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function generate() {
    setBusy(true);
    try {
      const r = await Admin.generateKeys(genPlan, genCount);
      setGenerated(r.codes);
      load();
      toast({ kind: "success", title: `${t("admin.keys.generated")}: ${r.codes.length}` });
    } catch (e: any) {
      toast({ kind: "error", title: t("common.error"), message: e?.message });
    } finally {
      setBusy(false);
    }
  }

  async function remove(k: AdminKey) {
    if (!confirm(t("admin.keys.deleteConfirm"))) return;
    try {
      await Admin.deleteKey(k.id);
      load();
    } catch (e: any) {
      toast({ kind: "error", title: t("common.error"), message: e?.message });
    }
  }

  const usedCount = keys.filter((k) => k.used).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-ink-2">
          {t("admin.keys.totalUsed", { total: keys.length, used: usedCount })}
        </div>
        <XButton onClick={() => { setGenerated(null); setGenOpen(true); }}>
          {t("admin.keys.generate")}
        </XButton>
      </div>

      <XTable<AdminKey>
        rows={keys}
        rowKey={(r) => r.id}
        emptyHint={loading ? t("common.loading") : t("admin.keys.empty")}
        columns={[
          { key: "plan", header: t("admin.keys.kind"), width: "100px", render: (r) => (
            <span className="font-medium text-ink-0 uppercase text-[11px] tracking-[0.08em]">{r.planId}</span>
          )},
          { key: "status", header: t("admin.keys.status"), width: "minmax(0, 1fr)", render: (r) => (
            <div className="flex items-center gap-2 text-[13px]">
              {r.used ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-ink-0" />
                  <span className="text-ink-1 truncate">{r.usedBy ?? "—"}</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full border border-ink-2" />
                  <span className="text-ink-2">{t("admin.keys.unused")}</span>
                </>
              )}
            </div>
          )},
          { key: "created", header: t("admin.keys.created"), width: "minmax(0, 0.7fr)", align: "right", render: (r) => (
            <span className="text-ink-2 text-[12px]">{formatDate(r.createdAt)}</span>
          )},
          { key: "del", header: "", width: "40px", align: "right", render: (r) => (
            r.used ? <span className="text-ink-3">—</span> : (
              <button onClick={() => remove(r)} className="text-ink-2 hover:text-ink-0 w-7 h-7 grid place-items-center rounded hover:bg-ink-0/5">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            )
          )},
        ]}
      />

      <XPopup open={genOpen} onClose={() => setGenOpen(false)} title={t("admin.keys.generateTitle")} width={460}>
        {generated ? (
          <div className="flex flex-col gap-3">
            <p className="text-[13px] text-ink-2">{t("admin.keys.copyHint")}</p>
            <div className="bg-bg-primary border border-line rounded-card p-3 max-h-64 overflow-auto">
              {generated.map((c) => (
                <div key={c} className="text-[13px] font-mono text-ink-0 select-all py-0.5">{c}</div>
              ))}
            </div>
            <XButton variant="secondary" fullWidth onClick={() => navigator.clipboard?.writeText(generated.join("\n"))}>
              {t("common.copyAll")}
            </XButton>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <div className="text-[12px] text-ink-2 mb-2 uppercase tracking-[0.08em]">{t("admin.keys.plan")}</div>
              <XSegmented<AdminKey["planId"]>
                value={genPlan}
                onChange={setGenPlan}
                options={PLANS as any}
                fullWidth
                size="sm"
              />
            </div>
            <div>
              <div className="text-[12px] text-ink-2 mb-2 uppercase tracking-[0.08em]">{t("admin.keys.count")}</div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setGenCount((c) => Math.max(1, c - 1))}
                  className="w-8 h-8 grid place-items-center rounded-full bg-bg-card border border-line hover:border-line-strong"
                >−</button>
                <span className="text-[18px] font-semibold tabular-nums w-12 text-center">{genCount}</span>
                <button
                  onClick={() => setGenCount((c) => Math.min(100, c + 1))}
                  className="w-8 h-8 grid place-items-center rounded-full bg-bg-card border border-line hover:border-line-strong"
                >+</button>
              </div>
            </div>
            <XButton fullWidth onClick={generate} loading={busy}>{t("admin.keys.generate")}</XButton>
          </div>
        )}
      </XPopup>
    </div>
  );
}
