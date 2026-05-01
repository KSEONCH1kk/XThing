import type { PluginListenerHandle } from "@capacitor/core";

export type VpnProtocol = "vless" | "hysteria2";

export interface ConnectOptions {
  protocol: VpnProtocol;
  address: string;
  port: number;
  /** Зашифрованный (или сырый JSON) payload конфига сервера. */
  payload: string;
}

export interface VpnStatus {
  state: "idle" | "connecting" | "connected" | "disconnecting" | "error";
  bytesUp?: number;
  bytesDown?: number;
  error?: string;
}

export interface XThingVpnPlugin {
  connect(options: ConnectOptions): Promise<void>;
  disconnect(): Promise<void>;
  /** Запросить разрешение VpnService у системы (показывает диалог). */
  prepare(): Promise<{ granted: boolean }>;
  addListener(
    eventName: "status",
    listener: (s: VpnStatus) => void
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}
