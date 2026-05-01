import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import dotenv from "dotenv";
import { VpnManager } from "./vpn/manager";
import { decryptConfig } from "./crypto";

// Загружаем .env из корня проекта (в dev) или из ресурсов (в проде).
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

// Совпадает с дефолтом server/src/env.ts — для dev-режима без явного ключа.
const DEFAULT_DEV_AES_KEY = "0".repeat(64);
const AES_KEY = process.env.SERVER_CONFIG_AES_KEY || process.env.XTHING_AES_KEY || DEFAULT_DEV_AES_KEY;

const isDev = process.env.NODE_ENV === "development";

let win: BrowserWindow | null = null;
const vpn = new VpnManager();

function createWindow() {
  win = new BrowserWindow({
    width: 460,
    height: 760,
    minWidth: 380,
    minHeight: 600,
    frame: false,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "hidden",
    backgroundColor: "#000000",
    title: "XThing",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.setMenuBarVisibility(false);

  win.on("maximize", () => win?.webContents.send("window:maximized", true));
  win.on("unmaximize", () => win?.webContents.send("window:maximized", false));

  if (isDev) {
    win.loadURL("http://localhost:5173");
  } else {
    win.loadFile(path.join(process.resourcesPath, "client", "index.html"));
  }

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  vpn.on("status", (s) => {
    win?.webContents.send("vpn:status", s);
  });
}

app.whenReady().then(() => {
  app.on("before-quit", async () => {
    try {
      await vpn.disconnect();
    } catch {
      /* ignore */
    }
  });

  ipcMain.handle(
    "vpn:connect",
    async (
      _e,
      encrypted: {
        protocol: string;
        address: string;
        port: number;
        payload: string;
        mode?: "tun" | "proxy";
        routing?: { defaultAction: "proxy" | "direct"; rules: { kind: string; value: string; action: string }[] };
      }
    ) => {
      // Пытаемся расшифровать payload AES-256-GCM. Если это невалидный шифр
      // (например, в dev сервер вернул plain JSON) — упадём в JSON.parse напрямую.
      let cfgJson: string;
      try {
        cfgJson = decryptConfig(encrypted.payload, AES_KEY);
      } catch {
        cfgJson = encrypted.payload;
      }

      let cfg: any;
      try {
        cfg = JSON.parse(cfgJson);
      } catch {
        throw new Error(
          "Не удалось разобрать конфиг сервера. Проверьте, что SERVER_CONFIG_AES_KEY совпадает на сервере и в Electron."
        );
      }

      await vpn.connect({
        protocol: encrypted.protocol as "vless" | "hysteria2",
        address: encrypted.address,
        port: encrypted.port,
        params: cfg,
        mode: encrypted.mode ?? "tun",
        routing: encrypted.routing as any,
      });
    }
  );

  ipcMain.handle("vpn:disconnect", async () => {
    await vpn.disconnect();
  });

  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.on("app:quit", () => app.quit());

  // Window controls для кастомного titlebar
  ipcMain.handle("window:minimize", () => win?.minimize());
  ipcMain.handle("window:maximize", () => {
    if (!win) return;
    if (win.isMaximized()) win.unmaximize();
    else win.maximize();
  });
  ipcMain.handle("window:close", () => win?.close());
  ipcMain.handle("window:isMaximized", () => win?.isMaximized() ?? false);

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
