import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import fs from "node:fs";
import dotenv from "dotenv";
import { VpnManager } from "./vpn/manager";
import { decryptConfig } from "./crypto";

// ---- Файловое логирование ----
// В упакованном exe нет stdout. Пишем всё в %APPDATA%\XThing\xthing.log
// (на Windows) — его можно открыть пока приложение работает.
function setupFileLogger() {
  try {
    const userDir = app.getPath("userData");
    fs.mkdirSync(userDir, { recursive: true });
    const logPath = path.join(userDir, "xthing.log");
    const stream = fs.createWriteStream(logPath, { flags: "w" });

    const wrap = (orig: (...a: any[]) => void, level: string) =>
      (...args: any[]) => {
        const line =
          `[${new Date().toISOString()}] [${level}] ` +
          args
            .map((a) =>
              typeof a === "string" ? a : a instanceof Error ? a.stack || String(a) : JSON.stringify(a)
            )
            .join(" ") +
          "\n";
        try {
          stream.write(line);
        } catch {}
        orig.apply(console, args);
      };

    console.log = wrap(console.log, "log");
    console.warn = wrap(console.warn, "warn");
    console.error = wrap(console.error, "error");
    console.info = wrap(console.info, "info");

    process.on("uncaughtException", (e) => {
      try {
        stream.write(`[${new Date().toISOString()}] [FATAL] ${e.stack || e}\n`);
      } catch {}
    });
    process.on("unhandledRejection", (e: any) => {
      try {
        stream.write(`[${new Date().toISOString()}] [REJECT] ${e?.stack || e}\n`);
      } catch {}
    });

    console.log(`[xthing] log file: ${logPath}`);
  } catch {
    /* fail silently */
  }
}
setupFileLogger();

// .env читается:
//  - в dev: из корня проекта
//  - в packaged-режиме: из process.resourcesPath/.env (туда копирует electron-builder)
const envCandidates = app.isPackaged
  ? [
      path.join(process.resourcesPath, ".env"),
      path.join(path.dirname(app.getPath("exe")), ".env"),
    ]
  : [path.join(__dirname, "..", "..", ".env")];

for (const p of envCandidates) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
    break;
  }
}

// Совпадает с дефолтом server/src/env.ts — для dev-режима без явного ключа.
const DEFAULT_DEV_AES_KEY = "f047ce40c922a9828e1fbe058882757d36b29a53a1ea7c9c4995362b807c16b3";
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

  // Клиент грузим по URL и в dev, и в проде — тот же origin, никаких CORS-проблем.
  // URL можно переопределить через XTHING_CLIENT_URL в .env (полезно если хочешь
  // тестить exe против стейджинга без пересборки).
  const clientUrl =
    process.env.XTHING_CLIENT_URL ||
    (isDev ? "http://localhost:5173" : "https://ccc.intave.tech");
  console.log(`[xthing] loading client from ${clientUrl}`);
  win.loadURL(clientUrl);

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
