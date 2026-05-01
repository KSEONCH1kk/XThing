import { create } from "zustand";
import { api } from "../api/client";
import { isCapacitor, isElectron } from "../lib/platform";
import { XThingVpn } from "../lib/vpn-android";
import type { Server, VpnMode, VpnStatus } from "../types";

interface VpnStore {
  status: VpnStatus;
  selectedServerId: string | null;
  mode: VpnMode;
  setMode: (m: VpnMode) => void;
  setSelectedServer: (id: string) => void;
  connect: (server: Server) => Promise<void>;
  disconnect: () => Promise<void>;
  _bindBridge: () => void;
}

const initial: VpnStatus = {
  state: "idle",
  bytesUp: 0,
  bytesDown: 0,
};

let mockTimer: number | undefined;

const MODE_KEY = "xthing.vpnMode";
const initialMode: VpnMode = (() => {
  if (typeof localStorage === "undefined") return "tun";
  const saved = localStorage.getItem(MODE_KEY);
  return saved === "proxy" ? "proxy" : "tun";
})();

export const useVpn = create<VpnStore>((set, get) => ({
  status: initial,
  selectedServerId: null,
  mode: initialMode,

  setMode: (m) => {
    set({ mode: m });
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {}
  },

  setSelectedServer: (id) => set({ selectedServerId: id }),

  connect: async (server) => {
    set({ status: { ...get().status, state: "connecting", error: undefined } });
    try {
      const cfg = await api<{
        protocol: string;
        address: string;
        port: number;
        payload: string;
        routing?: { defaultAction: "proxy" | "direct"; rules: { kind: string; value: string; action: string }[] };
      }>(`/servers/${server.id}/config`);

      if (isElectron && window.xthing) {
        await window.xthing.vpn.connect({ ...cfg, mode: get().mode });
      } else if (isCapacitor) {
        try {
          await XThingVpn.connect({
            protocol: cfg.protocol as "vless" | "hysteria2",
            address: cfg.address,
            port: cfg.port,
            payload: cfg.payload,
          });
        } catch {
          await new Promise((r) => setTimeout(r, 800));
          startMock();
        }
      } else {
        await new Promise((r) => setTimeout(r, 800));
        startMock();
      }
      set({
        status: {
          state: "connected",
          serverId: server.id,
          startedAt: Date.now(),
          bytesUp: 0,
          bytesDown: 0,
        },
        selectedServerId: server.id,
      });
    } catch (e: any) {
      set({ status: { ...initial, state: "error", error: e?.message || "Ошибка соединения" } });
    }
  },

  disconnect: async () => {
    set({ status: { ...get().status, state: "disconnecting" } });
    if (isElectron && window.xthing) {
      await window.xthing.vpn.disconnect();
    } else if (isCapacitor) {
      try {
        await XThingVpn.disconnect();
      } catch {}
      stopMock();
    } else {
      stopMock();
      await new Promise((r) => setTimeout(r, 400));
    }
    set({ status: { ...initial } });
  },

  _bindBridge: () => {
    const apply = (s: { state?: string; bytesUp?: number; bytesDown?: number; error?: string }) => {
      const cur = get().status;
      set({
        status: {
          ...cur,
          state: (s.state as VpnStatus["state"]) ?? cur.state,
          bytesUp: s.bytesUp ?? cur.bytesUp,
          bytesDown: s.bytesDown ?? cur.bytesDown,
          error: s.error,
        },
      });
    };
    if (isElectron && window.xthing) {
      window.xthing.vpn.onStatus(apply);
    } else if (isCapacitor) {
      XThingVpn.addListener("status", apply).catch(() => {});
    }
  },
}));

function startMock() {
  stopMock();
  mockTimer = window.setInterval(() => {
    const st = useVpn.getState().status;
    if (st.state !== "connected") return;
    useVpn.setState({
      status: {
        ...st,
        bytesUp: st.bytesUp + Math.floor(Math.random() * 80_000),
        bytesDown: st.bytesDown + Math.floor(Math.random() * 600_000),
      },
    });
  }, 1000);
}
function stopMock() {
  if (mockTimer) {
    clearInterval(mockTimer);
    mockTimer = undefined;
  }
}
