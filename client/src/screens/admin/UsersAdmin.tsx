import { useEffect, useState } from "react";
import { Admin, type AdminUser } from "../../api/admin";
import { XTable } from "../../components/XTable";
import { XSwitch } from "../../components/XSwitch";
import { useToast } from "../../store/toast";
import { useAuth } from "../../store/auth";
import { formatBytes, formatDate } from "../../lib/format";
import { useT } from "../../lib/i18n";

export function UsersAdmin() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const toast = useToast((s) => s.push);
  const me = useAuth((s) => s.user);
  const t = useT();

  const load = () =>
    Admin.users()
      .then(setUsers)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  async function toggleAdmin(u: AdminUser) {
    const next = !u.isAdmin;
    setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isAdmin: next } : x)));
    try {
      await Admin.setUserAdmin(u.id, next);
      toast({
        kind: "success",
        title: next ? t("admin.users.adminGranted") : t("admin.users.adminRevoked"),
        message: u.email,
      });
    } catch (e: any) {
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isAdmin: u.isAdmin } : x)));
      toast({ kind: "error", title: t("common.error"), message: e?.message });
    }
  }

  async function remove(u: AdminUser) {
    if (!confirm(`${t("admin.users.deleteConfirm")} ${u.email}?`)) return;
    try {
      await Admin.deleteUser(u.id);
      toast({ kind: "success", title: t("admin.users.deleted") });
      load();
    } catch (e: any) {
      toast({ kind: "error", title: t("common.error"), message: e?.message });
    }
  }

  return (
    <XTable<AdminUser>
      rows={users}
      rowKey={(r) => r.id}
      emptyHint={loading ? t("common.loading") : t("admin.users.empty")}
      columns={[
        { key: "email", header: t("admin.users.email"), width: "minmax(0, 1.6fr)", render: (r) => (
          <span className="font-medium text-ink-0 truncate">{r.email}</span>
        )},
        { key: "plan", header: t("admin.users.plan"), width: "minmax(0, 0.7fr)", render: (r) => (
          <span className="text-ink-1">{r.planId ?? "—"}</span>
        )},
        { key: "traffic", header: t("admin.users.traffic"), width: "minmax(0, 1fr)", render: (r) => (
          <span className="text-ink-2 tabular-nums">
            {r.trafficLimit === null
              ? `${formatBytes(r.trafficUsed ?? 0)} / ∞`
              : `${formatBytes(r.trafficUsed ?? 0)} / ${formatBytes(r.trafficLimit)}`}
          </span>
        )},
        { key: "expires", header: t("admin.users.expires"), width: "minmax(0, 0.8fr)", render: (r) => (
          <span className="text-ink-2">{formatDate(r.expiresAt ?? undefined)}</span>
        )},
        { key: "admin", header: "Admin", width: "70px", align: "center", render: (r) => (
          <XSwitch checked={r.isAdmin} onChange={() => toggleAdmin(r)} size="sm" disabled={r.id === me?.id} />
        )},
        { key: "del", header: "", width: "40px", align: "right", render: (r) => (
          r.id === me?.id ? <span className="text-ink-3">—</span> : (
            <button
              onClick={() => remove(r)}
              className="text-ink-2 hover:text-ink-0 w-7 h-7 grid place-items-center rounded hover:bg-ink-0/5"
              aria-label={t("common.delete")}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          )
        )},
      ]}
    />
  );
}
