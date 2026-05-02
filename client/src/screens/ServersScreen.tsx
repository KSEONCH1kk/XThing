import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { ServerCard } from "../components/ServerCard";
import { PageHeader } from "../components/PageHeader";
import type { Protocol, Server } from "../types";
import { useVpn } from "../store/vpn";
import { useToast } from "../store/toast";
import { useT } from "../lib/i18n";

export function ServersScreen() {
  const t = useT();
  const protoOptions: { id: Protocol | "all"; label: string }[] = [
    { id: "all", label: t("servers.protoAll") },
    { id: "vless", label: t("servers.protoVless") },
    { id: "hysteria2", label: t("servers.protoHysteria2") },
  ];
  const [servers, setServers] = useState<Server[]>([]);
  const [proto, setProto] = useState<Protocol | "all">("all");
  const [country, setCountry] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const selectedId = useVpn((s) => s.selectedServerId);
  const setSelected = useVpn((s) => s.setSelectedServer);
  const switchServer = useVpn((s) => s.switchServer);
  const status = useVpn((s) => s.status);
  const toast = useToast((s) => s.push);

  const refresh = async () => {
    setLoading(true);
    try {
      const list = await api<Server[]>("/servers");
      setServers(list);
    } catch (e: any) {
      toast({ kind: "error", title: t("servers.couldntLoad"), message: e?.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const countries = useMemo(
    () => Array.from(new Set(servers.map((s) => s.countryCode))).sort(),
    [servers]
  );

  const filtered = useMemo(
    () =>
      servers.filter(
        (s) => (proto === "all" || s.protocol === proto) && (country === "all" || s.countryCode === country)
      ),
    [servers, proto, country]
  );

  return (
    <div className="flex flex-col gap-4 p-5 max-w-md mx-auto">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[20px] font-semibold tracking-tight">{t("servers.title")}</h2>
        <button
          onClick={refresh}
          disabled={loading}
          className="w-9 h-9 grid place-items-center rounded-full bg-bg-card border border-line hover:border-line-strong transition-colors text-ink-0"
          aria-label="Обновить"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className={loading ? "ring-spin" : ""}>
            <path
              d="M2 8a6 6 0 0 1 10.5-4M14 8a6 6 0 0 1-10.5 4M12 2v3h-3M4 14v-3h3"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {protoOptions.map((p) => (
          <Chip key={p.id} active={proto === p.id} onClick={() => setProto(p.id)}>
            {p.label}
          </Chip>
        ))}
        <span className="w-px h-7 bg-line mx-1" />
        <Chip active={country === "all"} onClick={() => setCountry("all")}>
          {t("servers.countryAll")}
        </Chip>
        {countries.map((c) => (
          <Chip key={c} active={country === c} onClick={() => setCountry(c)}>
            {c}
          </Chip>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        <AnimatePresence mode="popLayout">
          {filtered.map((s, i) => (
            <motion.div
              key={s.id}
              layout
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0, transition: { delay: i * 0.04 } }}
              exit={{ opacity: 0, y: -8 }}
            >
              <ServerCard
                server={s}
                selected={selectedId === s.id}
                onClick={() => {
                  // Если активная сессия — switchServer запустит реконнект на
                  // выбранный, иначе просто выберет.
                  const wasActive = status.state === "connected" || status.state === "connecting";
                  void switchServer(s);
                  setSelected(s.id);
                  toast({
                    kind: "info",
                    title: wasActive ? t("main.serverSwitching") : t("main.serverChosen"),
                    message: s.name,
                  });
                }}
              />
            </motion.div>
          ))}
        </AnimatePresence>
        {filtered.length === 0 && !loading ? (
          <div className="text-center text-ink-2 text-[13px] py-8">{t("servers.notFound")}</div>
        ) : null}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onClick}
      className={[
        "h-8 px-3 rounded-full text-[12px] border transition-all",
        active
          ? "bg-ink-0 text-black border-ink-0"
          : "bg-bg-card border-line text-ink-2 hover:border-line-strong hover:text-ink-0",
      ].join(" ")}
    >
      {children}
    </motion.button>
  );
}
