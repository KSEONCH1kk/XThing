import { motion } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { ConnectButton } from "../components/ConnectButton";
import { TrafficBar } from "../components/TrafficBar";
import { VpnModeSwitch } from "../components/VpnModeSwitch";
import { RouteMap } from "../components/RouteMap";
import { PageHeader } from "../components/PageHeader";
import { api } from "../api/client";
import { useAuth } from "../store/auth";
import { useVpn } from "../store/vpn";
import type { Server } from "../types";
import { isCapacitor } from "../lib/platform";
import { formatBytes, formatDuration } from "../lib/format";
import { useToast } from "../store/toast";
import { useT } from "../lib/i18n";

export function MainScreen() {
  const sub = useAuth((s) => s.subscription);
  const user = useAuth((s) => s.user);
  const status = useVpn((s) => s.status);
  const selectedId = useVpn((s) => s.selectedServerId);
  const connect = useVpn((s) => s.connect);
  const disconnect = useVpn((s) => s.disconnect);
  const setSelected = useVpn((s) => s.setSelectedServer);
  const toast = useToast((s) => s.push);
  const t = useT();

  const [servers, setServers] = useState<Server[]>([]);
  const [, setTick] = useState(0);

  useEffect(() => {
    api<Server[]>("/servers")
      .then((list) => {
        setServers(list);
        if (!selectedId && list[0]) setSelected(list[0].id);
      })
      .catch(() => {});
  }, [selectedId, setSelected]);

  useEffect(() => {
    if (status.state !== "connected") return;
    const t = window.setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, [status.state]);

  const selected = useMemo(
    () => servers.find((s) => s.id === selectedId) ?? servers[0],
    [servers, selectedId]
  );
  const elapsed = status.startedAt ? Date.now() - status.startedAt : 0;

  const onPress = () => {
    if (status.state === "connected") {
      disconnect();
      return;
    }
    if (!selected) {
      toast({ kind: "info", title: t("main.noServers"), message: t("main.notLoaded") });
      return;
    }
    if (sub && !sub.active) {
      toast({ kind: "error", title: t("main.subInactive"), message: t("main.subActivateKey") });
      return;
    }
    connect(selected);
  };

  const reportTimer = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (status.state !== "connected") return;
    let lastUp = 0;
    let lastDown = 0;
    reportTimer.current = window.setInterval(async () => {
      const cur = useVpn.getState().status;
      const dUp = cur.bytesUp - lastUp;
      const dDown = cur.bytesDown - lastDown;
      lastUp = cur.bytesUp;
      lastDown = cur.bytesDown;
      if (dUp + dDown <= 0) return;
      try {
        await api("/traffic/report", {
          method: "POST",
          body: JSON.stringify({
            serverId: cur.serverId,
            bytesUp: dUp,
            bytesDown: dDown,
          }),
        });
      } catch {
        /* ignore */
      }
    }, 8000);
    return () => clearInterval(reportTimer.current);
  }, [status.state]);

  const trafficWarn =
    sub?.trafficLimit !== null &&
    sub?.trafficLimit !== undefined &&
    sub.trafficUsed / sub.trafficLimit > 0.9;

  return (
    <div className="flex flex-col gap-5 p-5 max-w-2xl mx-auto">
      <PageHeader>
        <header className="flex items-center justify-between">
          <div className="min-w-0">
            <div className="text-[11px] text-ink-2 uppercase tracking-[0.1em]">{t("main.account")}</div>
            <div className="text-[14px] font-medium truncate text-ink-0">{user?.email}</div>
          </div>
          <div className="text-right min-w-[140px]">
            <TrafficBar used={sub?.trafficUsed ?? 0} limit={sub?.trafficLimit ?? null} compact />
          </div>
        </header>
      </PageHeader>

      <RouteMap server={selected ?? null} state={status.state} />

      <div className="bg-bg-card border border-line rounded-card p-5 grid place-items-center gap-4 shadow-card">
        <ConnectButton state={status.state} onPress={onPress} size={isCapacitor ? 140 : 160} />
        {selected ? (
          <div className="text-center">
            <div className="text-[15px] font-medium text-ink-0">{selected.name}</div>
            <div className="text-[12px] text-ink-2 tracking-[0.04em]">
              {selected.city} · {selected.protocol.toUpperCase()}
              {status.state === "connected" ? <> · {formatDuration(elapsed)}</> : null}
            </div>
          </div>
        ) : null}
      </div>

      <VpnModeSwitch />

      <div className="grid grid-cols-2 gap-3">
        <Stat label={t("main.downloaded")} value={formatBytes(status.bytesDown)} icon={<ArrowDown />} />
        <Stat label={t("main.uploaded")} value={formatBytes(status.bytesUp)} icon={<ArrowUp />} />
      </div>

      {trafficWarn ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-card border border-ink-0 [border-style:dashed] bg-ink-0/[0.03] px-4 py-3 text-[13px] text-ink-1 flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-ink-0" />
          {t("main.lowTraffic")}
        </motion.div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon: JSX.Element }) {
  return (
    <div className="bg-bg-card border border-line rounded-card p-3.5">
      <div className="flex items-center gap-2 text-ink-2 text-[11px] uppercase tracking-[0.1em]">
        <span className="text-ink-0">{icon}</span>
        {label}
      </div>
      <div className="text-[18px] font-semibold mt-1.5 text-ink-0 tabular-nums">{value}</div>
    </div>
  );
}

function ArrowUp() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 12V3M7 3l-4 4M7 3l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ArrowDown() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path d="M7 2v9M7 11l-4-4M7 11l4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
