import { create } from "zustand";
import { useVpn } from "./vpn";

export interface UserGeo {
  lat: number;
  lng: number;
  city: string;
  country: string;
  fetchedAt: number;
}

interface GeoStore {
  geo: UserGeo | null;
  loading: boolean;
  error: string | null;
  /** Запрос только если VPN ВЫКЛЮЧЕН и кэша ещё нет. */
  fetchIfNeeded: () => Promise<void>;
  /** Принудительный refresh — игнорирует VPN-состояние (на свой риск). */
  forceRefresh: () => Promise<void>;
  /** Сброс кэша (если пользователь сохранил ошибочную VPN-локацию). */
  reset: () => void;
}

const KEY = "xthing.userGeo";

function load(): UserGeo | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const j = JSON.parse(raw);
    if (typeof j.lat !== "number" || typeof j.lng !== "number") return null;
    return j as UserGeo;
  } catch {
    return null;
  }
}

function save(geo: UserGeo) {
  try {
    localStorage.setItem(KEY, JSON.stringify(geo));
  } catch {}
}

async function tryIpapiCo(): Promise<UserGeo | null> {
  const r = await fetch("https://ipapi.co/json/", { cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json();
  if (typeof j.latitude !== "number" || typeof j.longitude !== "number") return null;
  return {
    lat: j.latitude,
    lng: j.longitude,
    city: j.city || "",
    country: j.country_name || j.country_code || "",
    fetchedAt: Date.now(),
  };
}

async function tryIpwhois(): Promise<UserGeo | null> {
  const r = await fetch("https://ipwho.is/", { cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json();
  if (j.success === false) return null;
  if (typeof j.latitude !== "number" || typeof j.longitude !== "number") return null;
  return {
    lat: j.latitude,
    lng: j.longitude,
    city: j.city || "",
    country: j.country || j.country_code || "",
    fetchedAt: Date.now(),
  };
}

async function tryIpinfo(): Promise<UserGeo | null> {
  const r = await fetch("https://ipinfo.io/json", { cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json();
  if (typeof j.loc !== "string") return null;
  const [latStr, lngStr] = j.loc.split(",");
  const lat = parseFloat(latStr || "");
  const lng = parseFloat(lngStr || "");
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return {
    lat,
    lng,
    city: j.city || "",
    country: j.country || "",
    fetchedAt: Date.now(),
  };
}

const PROVIDERS: { name: string; fn: () => Promise<UserGeo | null> }[] = [
  { name: "ipwho.is", fn: tryIpwhois },
  { name: "ipapi.co", fn: tryIpapiCo },
  { name: "ipinfo.io", fn: tryIpinfo },
];

async function fetchGeo(): Promise<{ geo: UserGeo | null; error: string | null }> {
  const errors: string[] = [];
  for (const p of PROVIDERS) {
    try {
      const r = await p.fn();
      if (r) {
        console.log(
          `[geo] ${p.name} → ${r.city || "?"}, ${r.country || "?"} (${r.lat.toFixed(2)}, ${r.lng.toFixed(2)})`
        );
        return { geo: r, error: null };
      }
      errors.push(`${p.name}: empty`);
    } catch (e: any) {
      errors.push(`${p.name}: ${e?.message || "fail"}`);
    }
  }
  return { geo: null, error: errors.join("; ") };
}

function isVpnOn(): boolean {
  const st = useVpn.getState().status.state;
  return st === "connected" || st === "connecting" || st === "disconnecting";
}

export const useUserGeo = create<GeoStore>((set, get) => ({
  geo: load(),
  loading: false,
  error: null,

  fetchIfNeeded: async () => {
    if (get().geo || get().loading) return;
    if (isVpnOn()) {
      console.log("[geo] skip fetch — VPN активен, дождёмся отключения");
      return;
    }
    set({ loading: true, error: null });
    const { geo, error } = await fetchGeo();
    if (geo) {
      save(geo);
      set({ geo, loading: false, error: null });
    } else {
      set({ loading: false, error });
      console.warn("[geo] все провайдеры упали:", error);
    }
  },

  forceRefresh: async () => {
    set({ loading: true, error: null });
    const { geo, error } = await fetchGeo();
    if (geo) {
      save(geo);
      set({ geo, loading: false, error: null });
    } else {
      set({ loading: false, error });
    }
  },

  reset: () => {
    try {
      localStorage.removeItem(KEY);
    } catch {}
    set({ geo: null, error: null });
  },
}));

// Когда VPN отключается — повторно запрашиваем гео (если ещё не было кэша
// или кэш получили в момент connecting).
useVpn.subscribe((s, prev) => {
  if (prev.status.state !== "idle" && s.status.state === "idle") {
    const g = useUserGeo.getState();
    if (!g.geo && !g.loading) {
      g.fetchIfNeeded();
    }
  }
});
