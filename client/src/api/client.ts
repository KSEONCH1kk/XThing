const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

const REFRESH_KEY = "xthing.refresh";

let accessToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAccessToken(t: string | null) {
  accessToken = t;
}
export function getAccessToken() {
  return accessToken;
}
export function bindUnauthorized(cb: () => void) {
  onUnauthorized = cb;
}

// Refresh-token хранится в localStorage параллельно с httpOnly-cookie.
// На web это дублирование не нужно, но в Capacitor WebView cross-site cookie
// не переживают перезапуск приложения — поэтому полагаемся на storage.
export function getRefreshToken(): string | null {
  try { return localStorage.getItem(REFRESH_KEY); } catch { return null; }
}
export function setRefreshToken(t: string | null) {
  try {
    if (t) localStorage.setItem(REFRESH_KEY, t);
    else localStorage.removeItem(REFRESH_KEY);
  } catch {}
}

async function refresh(): Promise<boolean> {
  try {
    const stored = getRefreshToken();
    const r = await fetch(`${API_URL}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: stored ? { "X-Refresh-Token": stored } : {},
    });
    if (!r.ok) {
      // refresh-токен мёртв — выкидываем, чтобы не зацикливаться.
      if (r.status === 401) setRefreshToken(null);
      return false;
    }
    const j = await r.json();
    accessToken = j.access;
    if (typeof j.refresh === "string") setRefreshToken(j.refresh);
    return true;
  } catch {
    return false;
  }
}

export async function api<T = any>(
  path: string,
  init: RequestInit & { auth?: boolean; skipRefresh?: boolean } = {}
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (init.auth !== false && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    credentials: "include",
  });

  if (res.status === 401 && init.auth !== false && !init.skipRefresh) {
    const ok = await refresh();
    if (ok) return api<T>(path, { ...init, skipRefresh: true });
    onUnauthorized?.();
    throw new ApiError("Unauthorized", 401);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const msg = typeof data?.error === "string" ? data.error : `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, data);
  }
  return data as T;
}

export class ApiError extends Error {
  constructor(msg: string, public status: number, public payload?: any) {
    super(msg);
  }
}

export const wsUrl = (() => import.meta.env.VITE_WS_URL || "ws://localhost:4000")();
