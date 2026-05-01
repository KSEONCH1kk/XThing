declare global {
  interface Window {
    xthing?: {
      vpn: {
        connect: (cfg: { protocol: string; address: string; port: number; payload: string; mode?: "tun" | "proxy" }) => Promise<void>;
        disconnect: () => Promise<void>;
        onStatus: (cb: (s: { state: string; bytesUp?: number; bytesDown?: number; error?: string }) => void) => () => void;
      };
      app: {
        version: () => Promise<string>;
        quit: () => void;
      };
      window: {
        minimize: () => Promise<void>;
        maximize: () => Promise<void>;
        close: () => Promise<void>;
        isMaximized: () => Promise<boolean>;
        onMaximizeChange: (cb: (maximized: boolean) => void) => () => void;
      };
    };
  }
}

export const isElectron = typeof window !== "undefined" && !!window.xthing;

export const isCapacitor =
  typeof window !== "undefined" &&
  // @ts-expect-error capacitor injected
  !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());

export const platform: "electron" | "android" | "web" = isElectron
  ? "electron"
  : isCapacitor
  ? "android"
  : "web";

export {};
