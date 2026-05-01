import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { Avatar } from "../components/Avatar";
import { TrafficBar } from "../components/TrafficBar";
import { XButton } from "../components/XButton";
import { XField } from "../components/XField";
import { XPopup } from "../components/XPopup";
import { api } from "../api/client";
import { useAuth } from "../store/auth";
import type { HistoryEntry } from "../types";
import { flagEmoji, formatBytes, formatDate } from "../lib/format";
import { useToast } from "../store/toast";
import { useI18n, useT } from "../lib/i18n";

interface Props {
  onOpenSettings: () => void;
}

export function ProfileScreen({ onOpenSettings }: Props) {
  const user = useAuth((s) => s.user);
  const sub = useAuth((s) => s.subscription);
  const logout = useAuth((s) => s.logout);
  const activate = useAuth((s) => s.activateKey);
  const toast = useToast((s) => s.push);
  const t = useT();
  const lang = useI18n((s) => s.lang);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [keyOpen, setKeyOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [keyErr, setKeyErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api<HistoryEntry[]>("/user/history").then(setHistory).catch(() => setHistory([]));
  }, []);

  const block = (i: number) => ({
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0, transition: { delay: i * 0.06 } },
  });
  const dateLocale = lang === "ru" ? "ru-RU" : "en-US";

  return (
    <div className="flex flex-col gap-4 p-5 max-w-md mx-auto">
      <motion.section
        {...block(0)}
        className="flex items-center gap-4 bg-bg-card border border-line rounded-card p-4"
      >
        <Avatar email={user?.email || "?"} size={64} />
        <div className="min-w-0">
          <div className="text-[16px] font-semibold truncate text-ink-0">{user?.email}</div>
          <div className="text-[12px] text-ink-2 mt-0.5">
            {t("profile.since")} {formatDate(user?.createdAt)}
          </div>
        </div>
      </motion.section>

      <motion.section {...block(1)} className="bg-bg-card border border-line rounded-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-[11px] text-ink-2 uppercase tracking-[0.1em]">{t("profile.plan")}</div>
            <div className="text-[16px] font-semibold text-ink-0">{sub?.title ?? "—"}</div>
          </div>
          <div className="text-right">
            <div className="text-[11px] text-ink-2 uppercase tracking-[0.1em]">{t("profile.expires")}</div>
            <div className="text-[14px] text-ink-1">{formatDate(sub?.expiresAt)}</div>
          </div>
        </div>
        <TrafficBar used={sub?.trafficUsed ?? 0} limit={sub?.trafficLimit ?? null} />
        <div className="flex gap-2 mt-4">
          <XButton variant="primary" fullWidth onClick={() => setKeyOpen(true)}>
            {t("profile.enterKey")}
          </XButton>
          <XButton variant="secondary" fullWidth onClick={() => setKeyOpen(true)}>
            {t("profile.extend")}
          </XButton>
        </div>
      </motion.section>

      <motion.section {...block(2)} className="bg-bg-card border border-line rounded-card p-4">
        <div className="text-[14px] font-medium mb-3 text-ink-0">{t("profile.history")}</div>
        {history.length === 0 ? (
          <div className="text-[12px] text-ink-2">{t("profile.noHistory")}</div>
        ) : (
          <ul className="flex flex-col gap-2">
            {history.map((h, i) => (
              <motion.li
                key={h.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0, transition: { delay: 0.04 * i } }}
                className="flex items-center gap-3 text-[13px]"
              >
                <span className="text-[18px] grayscale">{flagEmoji(h.countryCode || "")}</span>
                <span className="flex-1 min-w-0 truncate text-ink-1">{h.serverName ?? "—"}</span>
                <span className="text-ink-2 tabular-nums">
                  ↓{formatBytes(h.bytesDown, 0)} ↑{formatBytes(h.bytesUp, 0)}
                </span>
                <span className="text-ink-2 text-[11px] w-20 text-right">
                  {new Date(h.startedAt).toLocaleDateString(dateLocale)}
                </span>
              </motion.li>
            ))}
          </ul>
        )}
      </motion.section>

      <motion.div {...block(3)} className="flex flex-col gap-2">
        <button
          onClick={onOpenSettings}
          className="bg-bg-card border border-line rounded-card p-4 flex items-center justify-between hover:border-line-strong transition-colors text-left"
        >
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 grid place-items-center rounded-full border border-line">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
                <path
                  d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.4 1.4M11.6 11.6L13 13M3 13l1.4-1.4M11.6 4.4L13 3"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinecap="round"
                />
              </svg>
            </span>
            <div>
              <div className="text-[14px] font-medium text-ink-0">{t("profile.settings")}</div>
              <div className="text-[11px] text-ink-2">{t("profile.settingsDesc")}</div>
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l5 4-5 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>

        <XButton variant="ghost" fullWidth onClick={() => setLogoutOpen(true)}>
          {t("profile.logout")}
        </XButton>
      </motion.div>

      <XPopup open={keyOpen} onClose={() => setKeyOpen(false)} title={t("profile.activateKey")}>
        <p className="text-[13px] text-ink-2 mb-3">
          {t("profile.keyHint")} <span className="text-ink-0 font-mono">XTHING-XXXX-XXXX-XXXX</span>.
        </p>
        <XField
          label={t("login.key")}
          value={keyInput}
          onChange={(e) => setKeyInput(e.target.value.toUpperCase())}
          autoCapitalize="characters"
          spellCheck={false}
          error={keyErr}
        />
        <div className="flex gap-2 mt-4">
          <XButton variant="secondary" fullWidth onClick={() => setKeyOpen(false)}>
            {t("common.cancel")}
          </XButton>
          <XButton
            variant="primary"
            fullWidth
            loading={busy}
            onClick={async () => {
              setKeyErr(null);
              if (!/^XTHING(-[A-Z0-9]{4}){3}$/.test(keyInput.trim())) {
                setKeyErr(t("profile.invalidFormat"));
                return;
              }
              setBusy(true);
              try {
                await activate(keyInput.trim());
                toast({ kind: "success", title: t("profile.keyActivated") });
                setKeyOpen(false);
                setKeyInput("");
              } catch (e: any) {
                setKeyErr(e?.message || t("common.error"));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t("common.activate")}
          </XButton>
        </div>
      </XPopup>

      <XPopup open={logoutOpen} onClose={() => setLogoutOpen(false)} title={t("profile.logoutTitle")}>
        <p className="text-[13px] text-ink-2 mb-4">{t("profile.logoutDesc")}</p>
        <div className="flex gap-2">
          <XButton variant="secondary" fullWidth onClick={() => setLogoutOpen(false)}>
            {t("common.cancel")}
          </XButton>
          <XButton variant="danger" fullWidth onClick={logout}>
            {t("profile.logout")}
          </XButton>
        </div>
      </XPopup>
    </div>
  );
}
