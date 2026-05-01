import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { BottomTabs, type Tab } from "./components/BottomTabs";
import { XToastHost } from "./components/XToast";
import { WindowTitlebar } from "./components/WindowTitlebar";
import { Stage } from "./components/Stage";
import { LangSweep } from "./components/LangSweep";
import { SplashScreen } from "./screens/SplashScreen";
import { LoginScreen } from "./screens/LoginScreen";
import { MainScreen } from "./screens/MainScreen";
import { ServersScreen } from "./screens/ServersScreen";
import { ProfileScreen } from "./screens/ProfileScreen";
import { AdminScreen } from "./screens/AdminScreen";
import { SettingsScreen } from "./screens/SettingsScreen";
import { RoutingScreen } from "./screens/RoutingScreen";
import { useAuth } from "./store/auth";
import { useVpn } from "./store/vpn";
import { connectTrafficWs, disconnectTrafficWs, onTraffic } from "./api/ws";
import { getAccessToken } from "./api/client";
import { useToast } from "./store/toast";
import { isElectron } from "./lib/platform";
import { useT } from "./lib/i18n";

type SubView = "settings" | "routing" | null;

export default function App() {
  const [splash, setSplash] = useState(true);
  const [tab, setTab] = useState<Tab>("main");
  const [subView, setSubView] = useState<SubView>(null);
  const user = useAuth((s) => s.user);
  const refreshSubscription = useAuth((s) => s.refreshSubscription);
  const bootstrap = useAuth((s) => s.bootstrap);
  const bindBridge = useVpn((s) => s._bindBridge);
  const disconnect = useVpn((s) => s.disconnect);
  const status = useVpn((s) => s.status);
  const toast = useToast((s) => s.push);
  const t = useT();

  useEffect(() => {
    bootstrap();
    bindBridge();
  }, [bootstrap, bindBridge]);

  useEffect(() => {
    if (!user) return;
    const token = getAccessToken();
    if (!token) return;
    connectTrafficWs(token);
    const off = onTraffic(({ used, limit, exhausted }) => {
      refreshSubscription();
      if (exhausted && status.state === "connected") {
        toast({
          kind: "error",
          title: t("main.trafficExhausted"),
          message: t("main.trafficExhaustedDesc"),
        });
        disconnect();
      } else if (limit && used / limit > 0.9) {
        toast({ kind: "info", title: t("main.lowTrafficShort") });
      }
    });
    return () => {
      off();
      disconnectTrafficWs();
    };
  }, [user, refreshSubscription, disconnect, status.state, toast, t]);

  const viewKey = subView ?? tab;

  useEffect(() => {
    try {
      window.getSelection()?.removeAllRanges();
    } catch {}
  }, [viewKey]);

  const screen =
    subView === "routing" ? (
      <RoutingScreen onBack={() => setSubView("settings")} />
    ) : subView === "settings" ? (
      <SettingsScreen
        onBack={() => setSubView(null)}
        onOpenRouting={() => setSubView("routing")}
      />
    ) : tab === "main" ? (
      <MainScreen />
    ) : tab === "servers" ? (
      <ServersScreen />
    ) : tab === "admin" ? (
      <AdminScreen />
    ) : (
      <ProfileScreen onOpenSettings={() => setSubView("settings")} />
    );

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-bg-primary text-ink-0 noise">
      {isElectron ? <WindowTitlebar /> : null}

      <AnimatePresence>
        {splash ? (
          <motion.div
            key="splash"
            initial={{ pointerEvents: "auto" }}
            exit={{ opacity: 0, pointerEvents: "none" }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-50"
          >
            <SplashScreen onDone={() => setSplash(false)} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!splash ? (
        !user ? (
          <motion.div
            key="auth"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.18 }}
            className="flex-1 grid place-items-center px-5 py-10"
          >
            <LoginScreen />
          </motion.div>
        ) : (
          <div className="flex-1 flex flex-col min-h-0">
            <main className="flex-1 min-h-0 overflow-y-auto">
              <Stage pageKey={viewKey}>{screen}</Stage>
            </main>
            {subView === null ? (
              <BottomTabs active={tab} onChange={setTab} showAdmin={!!user.isAdmin} />
            ) : null}
          </div>
        )
      ) : null}

      <XToastHost />
      <LangSweep />
    </div>
  );
}
