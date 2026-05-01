import { EventEmitter } from "node:events";
import { ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";
import { buildXrayConfig, XRAY_API_PORT, type UserRouting } from "./xray";
import { buildHysteriaConfig, HYSTERIA_STATS_PORT, HYSTERIA_STATS_SECRET } from "./hysteria";
import { initXrayStatsClient, disposeXrayStatsClient, queryXrayStats } from "./stats/xrayStats";
import { queryHysteriaStats } from "./stats/hysteriaStats";
import { getAdapterStats } from "./stats/adapter";
import { TunController } from "./tun";

const TUN_ADAPTER_NAME = "XThing";

export type Protocol = "vless" | "hysteria2";

export interface ConnectArgs {
  protocol: Protocol;
  address: string;
  port: number;
  params: any;
  mode?: "tun" | "proxy";
  routing?: UserRouting;
}

function binDir(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "bin")
    : path.join(__dirname, "..", "..", "bin");
}

function tmpConfigPath(name: string): string {
  return path.join(os.tmpdir(), `xthing-${name}-${Date.now()}.json`);
}

export class VpnManager extends EventEmitter {
  private proc: ChildProcess | null = null;
  private cfgFile: string | null = null;
  private bytesUp = 0;
  private bytesDown = 0;
  private startedAt = 0;
  private statusInterval?: NodeJS.Timeout;
  private currentProtocol: Protocol | null = null;
  private tun: TunController | null = null;

  async connect(args: ConnectArgs): Promise<void> {
    if (this.proc) await this.disconnect();
    this.emit("status", { state: "connecting" });

    const exe = args.protocol === "vless" ? "xray" : "hysteria";
    const exeFile = process.platform === "win32" ? `${exe}.exe` : exe;
    const exePath = path.join(binDir(), exeFile);

    if (!fs.existsSync(exePath)) {
      this.emit("status", {
        state: "error",
        error: `Бинарник ${exeFile} не найден в ${binDir()}.`,
      });
      throw new Error(`Бинарник ${exeFile} не найден`);
    }

    const cfg =
      args.protocol === "vless"
        ? buildXrayConfig({ address: args.address, port: args.port, ...args.params }, args.routing)
        : buildHysteriaConfig({ server: `${args.address}:${args.port}`, ...args.params }, args.routing);

    this.cfgFile = tmpConfigPath(args.protocol);
    fs.writeFileSync(this.cfgFile, JSON.stringify(cfg, null, 2), "utf8");

    const cmd =
      args.protocol === "vless"
        ? [exePath, "-c", this.cfgFile]
        : [exePath, "client", "-c", this.cfgFile];

    this.proc = spawn(cmd[0]!, cmd.slice(1), {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    this.bytesUp = 0;
    this.bytesDown = 0;
    this.startedAt = Date.now();
    this.currentProtocol = args.protocol;

    this.proc.stdout?.on("data", (chunk: Buffer) => this.fallbackParse(chunk.toString()));
    this.proc.stderr?.on("data", (chunk: Buffer) => this.fallbackParse(chunk.toString()));

    this.proc.on("exit", (code) => {
      this.cleanupCfg();
      const wasConnecting = this.startedAt > 0;
      this.proc = null;
      if (this.statusInterval) clearInterval(this.statusInterval);
      this.statusInterval = undefined;
      disposeXrayStatsClient();
      this.teardownTun().catch(() => {});
      if (wasConnecting && code !== 0 && code !== null) {
        this.emit("status", { state: "error", error: `Процесс ${exe} завершился с кодом ${code}` });
      } else {
        this.emit("status", { state: "idle" });
      }
    });

    // Ждём, пока core поднимет SOCKS (1.5с — обычно достаточно)
    await new Promise((r) => setTimeout(r, 1500));
    if (!this.proc || this.proc.killed) {
      throw new Error("Процесс упал на старте");
    }

    // TUN — поднимаем только в режиме mode === "tun".
    // В "proxy" пользователь сам ходит через 127.0.0.1:10808 SOCKS5.
    if (args.mode !== "proxy" && TunController.available(binDir())) {
      const tun = new TunController(binDir());
      try {
        await tun.start(args.address);
        this.tun = tun;
        console.log("[xthing] TUN bridge active — system traffic routed through VPN");
      } catch (e: any) {
        console.warn(
          "[xthing] TUN setup failed → fallback на SOCKS-only (127.0.0.1:10808):",
          e?.message
        );
      }
    } else if (args.mode === "proxy") {
      console.log("[xthing] proxy mode: SOCKS5 на 127.0.0.1:10808 (TUN отключён)");
    } else {
      console.log("[xthing] tun2socks/wintun не найдены → SOCKS-only");
    }

    if (!this.proc || this.proc.killed) {
      throw new Error("Процесс упал во время поднятия TUN");
    }

    // Только теперь — connected. До этого момента UI в "connecting".
    this.startedAt = Date.now(); // сброс таймера на момент реального коннекта
    this.emit("status", { state: "connected", bytesUp: 0, bytesDown: 0 });

    if (this.currentProtocol === "vless") {
      try {
        initXrayStatsClient(XRAY_API_PORT);
      } catch {
        /* fallback to log parser */
      }
    }
    this.startStatsPolling();
  }

  async disconnect(): Promise<void> {
    if (!this.proc && !this.tun) {
      this.emit("status", { state: "idle" });
      return;
    }
    this.emit("status", { state: "disconnecting" });
    if (this.statusInterval) clearInterval(this.statusInterval);
    disposeXrayStatsClient();

    // ВАЖНО: сначала валим TUN — иначе всё системное соединение пойдёт в дохлый
    // SOCKS до самого завершения этого метода.
    await this.teardownTun();

    const p = this.proc;
    this.proc = null;
    if (p) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(() => {
          try {
            p.kill("SIGKILL");
          } catch {}
          resolve();
        }, 2500);
        p.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
        try {
          if (process.platform === "win32") {
            spawn("taskkill", ["/pid", String(p.pid), "/t", "/f"], { windowsHide: true });
          } else {
            p.kill("SIGTERM");
          }
        } catch {
          clearTimeout(timer);
          resolve();
        }
      });
    }
    this.cleanupCfg();
    this.currentProtocol = null;
    this.emit("status", { state: "idle" });
  }

  private async teardownTun() {
    if (!this.tun) return;
    const t = this.tun;
    this.tun = null;
    try {
      await t.stop();
    } catch (e: any) {
      console.warn("[xthing] TUN teardown error:", e?.message);
    }
  }

  private pollInProgress = false;

  private startStatsPolling() {
    this.statusInterval = setInterval(() => {
      // Не накапливаем медленные poll-запросы (Get-NetAdapterStatistics ~200мс)
      if (this.pollInProgress) return;
      this.pollInProgress = true;
      this.collectStats()
        .catch(() => {})
        .finally(() => {
          this.pollInProgress = false;
        });
    }, 1000);
  }

  private async collectStats() {
    let snap: { bytesUp: number; bytesDown: number } | null = null;

    // Если TUN активен — берём счётчики wintun-адаптера. Это самый надёжный
    // источник: считаем байты на уровне ОС, работает для обоих протоколов.
    if (this.tun) {
      snap = await getAdapterStats(TUN_ADAPTER_NAME);
    }

    // Иначе (SOCKS-only режим) — protocol-specific API.
    if (!snap) {
      try {
        snap =
          this.currentProtocol === "vless"
            ? await queryXrayStats()
            : await queryHysteriaStats(HYSTERIA_STATS_PORT, HYSTERIA_STATS_SECRET);
      } catch {
        /* keep previous values */
      }
    }

    if (snap) {
      this.bytesUp = snap.bytesUp;
      this.bytesDown = snap.bytesDown;
    }

    this.emit("status", {
      state: "connected",
      bytesUp: this.bytesUp,
      bytesDown: this.bytesDown,
    });
  }

  private fallbackParse(text: string) {
    const upMatch = text.match(/(?:up(?:link)?|sent)[^\d]+(\d+)/i);
    const dnMatch = text.match(/(?:down(?:link)?|recv)[^\d]+(\d+)/i);
    if (upMatch?.[1] && this.bytesUp === 0) this.bytesUp = Number(upMatch[1]);
    if (dnMatch?.[1] && this.bytesDown === 0) this.bytesDown = Number(dnMatch[1]);
  }

  private cleanupCfg() {
    if (this.cfgFile && fs.existsSync(this.cfgFile)) {
      try {
        fs.unlinkSync(this.cfgFile);
      } catch {
        /* ignore */
      }
    }
    this.cfgFile = null;
  }
}
