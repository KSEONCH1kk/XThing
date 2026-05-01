import { useEffect, useState } from "react";
import { Admin, type AdminServer, type ServerInput } from "../../api/admin";
import { XTable } from "../../components/XTable";
import { XButton } from "../../components/XButton";
import { XPopup } from "../../components/XPopup";
import { XField } from "../../components/XField";
import { XSwitch } from "../../components/XSwitch";
import { XSegmented } from "../../components/XSegmented";
import { useToast } from "../../store/toast";
import { flagEmoji } from "../../lib/format";
import { useT } from "../../lib/i18n";
import { parseServer } from "../../lib/server-parsers";

const emptyInput: ServerInput = {
  name: "",
  countryCode: "",
  city: "",
  protocol: "vless",
  address: "",
  port: 443,
  params: {},
  enabled: true,
  loadPercent: 0,
};

export function ServersAdmin() {
  const [servers, setServers] = useState<AdminServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [editing, setEditing] = useState<AdminServer | null>(null);
  const [input, setInput] = useState<ServerInput>(emptyInput);
  const [paramsJson, setParamsJson] = useState("{}");
  const [busy, setBusy] = useState(false);
  const [importText, setImportText] = useState("");
  const toast = useToast((s) => s.push);
  const t = useT();

  function applyImport() {
    const parsed = parseServer(importText);
    if (!parsed) {
      toast({ kind: "error", title: t("admin.servers.importFailed") });
      return;
    }
    setInput((cur) => ({
      ...cur,
      name: parsed.name || cur.name,
      countryCode: parsed.countryCode || cur.countryCode,
      protocol: parsed.protocol,
      address: parsed.address,
      port: parsed.port,
    }));
    setParamsJson(JSON.stringify(parsed.params, null, 2));
    setImportText("");
    toast({ kind: "success", title: t("admin.servers.importApplied") });
  }

  const load = () =>
    Admin.servers()
      .then(setServers)
      .catch(() => {})
      .finally(() => setLoading(false));

  useEffect(() => {
    load();
  }, []);

  function open(s: AdminServer | null) {
    setEditing(s);
    if (s) {
      setInput({
        name: s.name,
        countryCode: s.countryCode,
        city: s.city,
        protocol: s.protocol,
        address: s.address,
        port: s.port,
        params: {},
        enabled: s.enabled,
        loadPercent: s.loadPercent,
      });
      setParamsJson("{}");
    } else {
      setInput(emptyInput);
      setParamsJson(
        '{\n  "id": "uuid-here",\n  "flow": "xtls-rprx-vision",\n  "network": "tcp",\n  "security": "reality",\n  "sni": "...",\n  "pbk": "...",\n  "sid": "..."\n}'
      );
    }
    setEditOpen(true);
  }

  async function save() {
    setBusy(true);
    let params: Record<string, any>;
    try {
      params = JSON.parse(paramsJson || "{}");
    } catch {
      toast({ kind: "error", title: t("admin.servers.invalidJson") });
      setBusy(false);
      return;
    }
    const data: ServerInput = { ...input, params };
    try {
      if (editing) await Admin.updateServer(editing.id, data);
      else await Admin.createServer(data);
      setEditOpen(false);
      load();
      toast({ kind: "success", title: editing ? t("admin.servers.saved") : t("admin.servers.added") });
    } catch (e: any) {
      toast({ kind: "error", title: t("common.error"), message: e?.message });
    } finally {
      setBusy(false);
    }
  }

  async function toggle(s: AdminServer) {
    const next = !s.enabled;
    setServers((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: next } : x)));
    try {
      await Admin.setServerEnabled(s.id, next);
    } catch (e: any) {
      setServers((prev) => prev.map((x) => (x.id === s.id ? { ...x, enabled: s.enabled } : x)));
      toast({ kind: "error", title: t("common.error"), message: e?.message });
    }
  }

  async function remove(s: AdminServer) {
    if (!confirm(`${t("admin.servers.deleteConfirm")} ${s.name}?`)) return;
    try {
      await Admin.deleteServer(s.id);
      load();
    } catch (e: any) {
      toast({ kind: "error", title: t("common.error"), message: e?.message });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-[13px] text-ink-2">{t("admin.servers.total", { n: servers.length })}</div>
        <XButton onClick={() => open(null)}>{t("admin.servers.add")}</XButton>
      </div>

      <XTable<AdminServer>
        rows={servers}
        rowKey={(r) => r.id}
        emptyHint={loading ? t("common.loading") : t("admin.servers.empty")}
        columns={[
          { key: "flag", header: "", width: "30px", render: (r) => (
            <span className="text-[18px] grayscale">{flagEmoji(r.countryCode)}</span>
          )},
          { key: "name", header: t("admin.servers.name"), width: "minmax(0, 1.4fr)", render: (r) => (
            <span className="font-medium text-ink-0 truncate">{r.name}</span>
          )},
          { key: "addr", header: t("admin.servers.address"), width: "minmax(0, 1.2fr)", render: (r) => (
            <span className="text-ink-1 font-mono text-[12px] truncate">{r.address}:{r.port}</span>
          )},
          { key: "proto", header: t("admin.servers.proto"), width: "100px", render: (r) => (
            <span className="text-[10px] uppercase tracking-[0.1em] px-1.5 py-0.5 rounded border border-line text-ink-2">{r.protocol}</span>
          )},
          { key: "load", header: t("admin.servers.load"), width: "60px", align: "right", render: (r) => (
            <span className="text-ink-2 tabular-nums">{r.loadPercent}%</span>
          )},
          { key: "enabled", header: t("admin.servers.on"), width: "60px", align: "center", render: (r) => (
            <XSwitch checked={r.enabled} onChange={() => toggle(r)} size="sm" />
          )},
          { key: "actions", header: "", width: "80px", align: "right", render: (r) => (
            <div className="flex items-center justify-end gap-1">
              <button onClick={() => open(r)} className="text-ink-2 hover:text-ink-0 w-7 h-7 grid place-items-center rounded hover:bg-ink-0/5" aria-label={t("common.edit")}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M9 2.5l2.5 2.5L4 12.5H1.5V10L9 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" fill="none" />
                </svg>
              </button>
              <button onClick={() => remove(r)} className="text-ink-2 hover:text-ink-0 w-7 h-7 grid place-items-center rounded hover:bg-ink-0/5" aria-label={t("common.delete")}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>
          )},
        ]}
      />

      <XPopup open={editOpen} onClose={() => setEditOpen(false)} title={editing ? t("admin.servers.editTitle") : t("admin.servers.newTitle")} width={520}>
        <div className="flex flex-col gap-3">
          {/* Импорт из URL/JSON — авто-заполняет форму ниже */}
          <div className="bg-bg-primary/50 border border-line rounded-card p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] text-ink-2 uppercase tracking-[0.08em]">{t("admin.servers.import")}</div>
              <XButton variant="secondary" onClick={applyImport} className="!h-7 !px-3 !text-[11px]">
                {t("admin.servers.importParse")}
              </XButton>
            </div>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={t("admin.servers.importHint")}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              rows={2}
              className="w-full bg-bg-card border border-line rounded-field text-[11px] font-mono text-ink-0 p-2 outline-none focus:border-ink-0/60 resize-none"
            />
          </div>

          <XField label={t("admin.servers.name")} value={input.name} onChange={(e) => setInput({ ...input, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <XField label={t("admin.servers.country")} value={input.countryCode} onChange={(e) => setInput({ ...input, countryCode: e.target.value.toUpperCase().slice(0, 2) })} />
            <XField label={t("admin.servers.city")} value={input.city} onChange={(e) => setInput({ ...input, city: e.target.value })} />
          </div>
          <div>
            <div className="text-[12px] text-ink-2 mb-2 uppercase tracking-[0.08em]">{t("admin.servers.protocol")}</div>
            <XSegmented<"vless" | "hysteria2">
              value={input.protocol}
              onChange={(v) => setInput({ ...input, protocol: v })}
              options={[{ value: "vless", label: "VLESS" }, { value: "hysteria2", label: "Hysteria2" }]}
              fullWidth size="sm"
            />
          </div>
          <div className="grid grid-cols-[1fr_100px] gap-3">
            <XField label={t("admin.servers.address")} value={input.address} onChange={(e) => setInput({ ...input, address: e.target.value })} />
            <XField label={t("admin.servers.port")} type="number" value={String(input.port)} onChange={(e) => setInput({ ...input, port: Number(e.target.value) || 0 })} />
          </div>
          <div>
            <div className="text-[12px] text-ink-2 mb-2 uppercase tracking-[0.08em]">{t("admin.servers.params")}</div>
            <textarea
              value={paramsJson}
              onChange={(e) => setParamsJson(e.target.value)}
              spellCheck={false}
              rows={9}
              className="w-full bg-bg-card border border-line rounded-field text-[12px] font-mono text-ink-0 p-3 outline-none focus:border-ink-0/60"
            />
            {!editing ? (
              <div className="text-[11px] text-ink-3 mt-1.5">{t("admin.servers.paramsHint")}</div>
            ) : null}
          </div>
          <div className="flex items-center justify-between">
            <XSwitch checked={input.enabled} onChange={(v) => setInput({ ...input, enabled: v })} label={t("admin.servers.enabled")} />
            <div className="flex items-center gap-2 text-[13px]">
              <span className="text-ink-2">{t("admin.servers.load")} %</span>
              <input
                type="number"
                min={0}
                max={100}
                value={input.loadPercent}
                onChange={(e) => setInput({ ...input, loadPercent: Number(e.target.value) || 0 })}
                className="w-16 bg-bg-card border border-line rounded-field text-ink-0 px-2 py-1 outline-none focus:border-ink-0/60 tabular-nums"
              />
            </div>
          </div>
          <div className="flex gap-2 mt-2">
            <XButton variant="secondary" fullWidth onClick={() => setEditOpen(false)}>{t("common.cancel")}</XButton>
            <XButton fullWidth onClick={save} loading={busy}>{editing ? t("common.save") : t("common.create")}</XButton>
          </div>
        </div>
      </XPopup>
    </div>
  );
}
