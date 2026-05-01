import { contextBridge, ipcRenderer } from "electron";

type StatusListener = (s: { state: string; bytesUp?: number; bytesDown?: number; error?: string }) => void;

contextBridge.exposeInMainWorld("xthing", {
  vpn: {
    connect: (cfg: {
      protocol: string;
      address: string;
      port: number;
      payload: string;
      mode?: "tun" | "proxy";
      routing?: any;
    }) => ipcRenderer.invoke("vpn:connect", cfg),
    disconnect: () => ipcRenderer.invoke("vpn:disconnect"),
    onStatus: (cb: StatusListener) => {
      const handler = (_: unknown, s: any) => cb(s);
      ipcRenderer.on("vpn:status", handler);
      return () => ipcRenderer.off("vpn:status", handler);
    },
  },
  app: {
    version: () => ipcRenderer.invoke("app:version"),
    quit: () => ipcRenderer.send("app:quit"),
  },
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
    onMaximizeChange: (cb: (maximized: boolean) => void) => {
      const handler = (_: unknown, val: boolean) => cb(val);
      ipcRenderer.on("window:maximized", handler);
      return () => ipcRenderer.off("window:maximized", handler);
    },
  },
});
