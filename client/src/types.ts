export type Protocol = "vless" | "hysteria2";

export interface Server {
  id: string;
  name: string;
  countryCode: string;
  city: string;
  protocol: Protocol;
  loadPercent: number;
  pingMs?: number;
}

export interface ServerConfig {
  protocol: Protocol;
  address: string;
  port: number;
  payload: string; // encrypted base64
}

export interface Subscription {
  active: boolean;
  planId?: string;
  title?: string;
  trafficLimit: number | null;
  trafficUsed: number;
  expiresAt?: string;
}

export interface User {
  id: string;
  email: string;
  isAdmin?: boolean;
  createdAt?: string;
}

export type VpnMode = "tun" | "proxy";

export interface HistoryEntry {
  id: string;
  serverId: string | null;
  serverName: string | null;
  countryCode: string | null;
  startedAt: string;
  endedAt: string | null;
  bytesUp: number;
  bytesDown: number;
}

export type VpnState = "idle" | "connecting" | "connected" | "disconnecting" | "error";

export interface VpnStatus {
  state: VpnState;
  serverId?: string;
  ip?: string;
  startedAt?: number;
  bytesUp: number;
  bytesDown: number;
  error?: string;
}
