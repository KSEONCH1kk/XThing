import { registerPlugin, type PluginListenerHandle } from "@capacitor/core";

// Регистрируем нативный плагин по имени. На Android Capacitor найдёт класс
// `@CapacitorPlugin(name = "XThingVpn")`. На web/electron — registerPlugin
// вернёт прокси, методы которого бросают `unimplemented` при вызове.
//
// Тип-определение специально живёт ЗДЕСЬ, а не в npm-пакете плагина,
// чтобы клиенту не нужно было собирать плагин для запуска dev-сервера.

export type VpnProtocol = "vless" | "hysteria2";

export interface ConnectOptions {
  protocol: VpnProtocol;
  address: string;
  port: number;
  payload: string;
}

export interface VpnStatus {
  state: "idle" | "connecting" | "connected" | "disconnecting" | "error";
  bytesUp?: number;
  bytesDown?: number;
  error?: string;
}

export interface XThingVpnPlugin {
  connect(opts: ConnectOptions): Promise<void>;
  disconnect(): Promise<void>;
  prepare(): Promise<{ granted: boolean }>;
  addListener(
    eventName: "status",
    listener: (s: VpnStatus) => void
  ): Promise<PluginListenerHandle>;
  removeAllListeners(): Promise<void>;
}

export const XThingVpn = registerPlugin<XThingVpnPlugin>("XThingVpn");
