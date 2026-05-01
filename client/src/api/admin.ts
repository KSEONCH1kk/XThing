import { api } from "./client";

export interface AdminStats {
  users: number;
  activeSubs: number;
  keys: { total: number; used: number };
  servers: number;
  traffic: { up: number; down: number };
  sparkline: { date: string; up: number; down: number }[];
}

export interface AdminUser {
  id: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  planId: string | null;
  trafficUsed: number | null;
  trafficLimit: number | null;
  expiresAt: string | null;
}

export interface AdminKey {
  id: string;
  planId: "trial" | "basic" | "pro" | "unlimited";
  used: boolean;
  usedBy: string | null;
  usedAt: string | null;
  createdAt: string;
}

export interface AdminServer {
  id: string;
  name: string;
  countryCode: string;
  city: string;
  protocol: "vless" | "hysteria2";
  address: string;
  port: number;
  loadPercent: number;
  enabled: boolean;
}

export interface ServerInput {
  name: string;
  countryCode: string;
  city: string;
  protocol: "vless" | "hysteria2";
  address: string;
  port: number;
  params: Record<string, any>;
  enabled: boolean;
  loadPercent: number;
}

export const Admin = {
  stats: () => api<AdminStats>("/admin/stats"),
  users: () => api<AdminUser[]>("/admin/users"),
  setUserAdmin: (id: string, isAdmin: boolean) =>
    api<{ ok: true }>(`/admin/users/${id}/admin`, { method: "PATCH", body: JSON.stringify({ isAdmin }) }),
  deleteUser: (id: string) => api<{ ok: true }>(`/admin/users/${id}`, { method: "DELETE" }),

  keys: () => api<AdminKey[]>("/admin/keys"),
  generateKeys: (planId: AdminKey["planId"], count = 1) =>
    api<{ codes: string[] }>("/admin/keys", {
      method: "POST",
      body: JSON.stringify({ planId, count }),
    }),
  deleteKey: (id: string) => api<{ ok: true }>(`/admin/keys/${id}`, { method: "DELETE" }),

  servers: () => api<AdminServer[]>("/admin/servers"),
  createServer: (s: ServerInput) =>
    api<{ id: string }>("/admin/servers", { method: "POST", body: JSON.stringify(s) }),
  updateServer: (id: string, s: ServerInput) =>
    api<{ ok: true }>(`/admin/servers/${id}`, { method: "PUT", body: JSON.stringify(s) }),
  deleteServer: (id: string) => api<{ ok: true }>(`/admin/servers/${id}`, { method: "DELETE" }),
  setServerEnabled: (id: string, enabled: boolean) =>
    api<{ ok: true }>(`/admin/servers/${id}/enabled`, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),
};
