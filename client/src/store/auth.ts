import { create } from "zustand";
import { api, bindUnauthorized, getRefreshToken, setAccessToken, setRefreshToken } from "../api/client";
import type { User, Subscription } from "../types";

interface AuthState {
  user: User | null;
  subscription: Subscription | null;
  loading: boolean;
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, key: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshSubscription: () => Promise<void>;
  activateKey: (key: string) => Promise<void>;
}

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

// Fetch с таймаутом — чтобы bootstrap не висел вечно, если backend недоступен.
function fetchWithTimeout(input: RequestInfo, init: RequestInit & { timeoutMs?: number } = {}) {
  const ctrl = new AbortController();
  const timeoutMs = init.timeoutMs ?? 4000;
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

export const useAuth = create<AuthState>((set, get) => ({
  user: null,
  subscription: null,
  loading: true,

  bootstrap: async () => {
    bindUnauthorized(() => {
      setAccessToken(null);
      setRefreshToken(null);
      set({ user: null, subscription: null });
    });
    try {
      const stored = getRefreshToken();
      const r = await fetchWithTimeout(API_URL + "/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: stored ? { "X-Refresh-Token": stored } : {},
        timeoutMs: 4000,
      });
      if (r.ok) {
        const j = await r.json();
        setAccessToken(j.access);
        if (typeof j.refresh === "string") setRefreshToken(j.refresh);
        const me = await api<User>("/user/me");
        set({ user: me });
        await get().refreshSubscription();
      } else if (r.status === 401) {
        // мёртвый или отсутствующий refresh — чистим, чтобы не дёргать его снова.
        setRefreshToken(null);
      }
    } catch {
      // backend не отвечает или нет refresh-cookie — просто покажем экран входа
    } finally {
      set({ loading: false });
    }
  },

  login: async (email, password) => {
    const r = await api<{ access: string; refresh?: string; user: User }>("/auth/login", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(r.access);
    if (r.refresh) setRefreshToken(r.refresh);
    set({ user: r.user });
    await get().refreshSubscription();
  },

  register: async (email, password, key) => {
    const r = await api<{ access: string; refresh?: string; user: User }>("/auth/register", {
      method: "POST",
      auth: false,
      body: JSON.stringify({ email, password, key }),
    });
    setAccessToken(r.access);
    if (r.refresh) setRefreshToken(r.refresh);
    set({ user: r.user });
    await get().refreshSubscription();
  },

  logout: async () => {
    const stored = getRefreshToken();
    try {
      await api("/auth/logout", {
        method: "POST",
        headers: stored ? { "X-Refresh-Token": stored } : {},
      });
    } catch {
      /* ignore */
    }
    setAccessToken(null);
    setRefreshToken(null);
    set({ user: null, subscription: null });
  },

  refreshSubscription: async () => {
    try {
      const s = await api<Subscription>("/user/subscription");
      set({ subscription: s });
    } catch {
      set({ subscription: null });
    }
  },

  activateKey: async (key) => {
    await api("/keys/activate", { method: "POST", body: JSON.stringify({ key }) });
    await get().refreshSubscription();
  },
}));
