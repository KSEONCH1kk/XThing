import { motion } from "framer-motion";
import { useVpn } from "../store/vpn";
import { useToast } from "../store/toast";
import type { VpnMode } from "../types";
import { useT } from "../lib/i18n";

export function VpnModeSwitch() {
  const mode = useVpn((s) => s.mode);
  const setMode = useVpn((s) => s.setMode);
  const status = useVpn((s) => s.status);
  const toast = useToast((s) => s.push);
  const t = useT();

  const change = (m: VpnMode) => {
    if (status.state !== "idle" && status.state !== "error") {
      toast({ kind: "info", title: t("mode.disconnectFirst"), message: t("mode.idleOnly") });
      return;
    }
    setMode(m);
  };

  const items: { id: VpnMode; title: string; desc: string; icon: JSX.Element }[] = [
    { id: "tun", title: t("mode.tun"), desc: t("mode.tunDesc"), icon: <ShieldIcon /> },
    { id: "proxy", title: t("mode.proxy"), desc: t("mode.proxyDesc"), icon: <PlugIcon /> },
  ];

  return (
    <div className="bg-bg-card border border-line rounded-card p-1.5 grid grid-cols-2 gap-1.5 relative">
      {items.map((it) => {
        const active = mode === it.id;
        return (
          <button
            key={it.id}
            onClick={() => change(it.id)}
            className="relative rounded-card px-3 py-3 text-left no-select overflow-hidden"
          >
            {active ? (
              <motion.span
                layoutId="vpn-mode-bg"
                className="absolute inset-0 bg-ink-0/[0.07] border border-line-strong rounded-card"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            ) : null}
            <div className="relative flex items-start gap-2.5">
              <span
                className={[
                  "shrink-0 w-9 h-9 grid place-items-center rounded-full border transition-colors",
                  active ? "bg-ink-0 text-black border-ink-0" : "border-line text-ink-2",
                ].join(" ")}
              >
                {it.icon}
              </span>
              <div className="min-w-0">
                <div className={["text-[13px] font-medium leading-tight", active ? "text-ink-0" : "text-ink-1"].join(" ")}>
                  {it.title}
                </div>
                <div className="text-[11px] text-ink-2 mt-0.5 leading-tight">{it.desc}</div>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function ShieldIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" stroke="currentColor" strokeWidth="1.6" />
      <path d="M8 12l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PlugIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M9 4v5M15 4v5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6 9h12v3a6 6 0 0 1-12 0V9zM12 18v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
