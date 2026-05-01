/**
 * TUN-бридж на Windows: wintun + tun2socks → SOCKS5.
 *
 * Конфиг по умолчанию совпадает с тем, что используется в v2rayN/sing-box
 * и других популярных клиентах: /24 на 198.18.0.0, gateway=none, отдельные
 * netsh для DNS, default route через адаптер с metric=1.
 */
import { ChildProcess, execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import dnsP from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";

const execFileP = promisify(execFile);

const TUN_NAME = "XThing";
const TUN_ADDR = "198.18.0.1";
const TUN_MASK = "255.255.255.0"; // /24 — стандарт для Windows wintun
const TUN_GATEWAY = TUN_ADDR; // self as next-hop (point-to-point)
const SOCKS_PORT = 10808;
const TUN_DNS_PRIMARY = "1.1.1.1";
const TUN_DNS_SECONDARY = "8.8.8.8";

export class TunController {
  private proc: ChildProcess | null = null;
  private serverIp: string | null = null;
  private origGateway: string | null = null;
  private ifIndex: number | null = null;

  constructor(private binDir: string) {}

  static available(binDir: string): boolean {
    if (process.platform !== "win32") return false;
    return (
      fs.existsSync(path.join(binDir, "tun2socks.exe")) &&
      fs.existsSync(path.join(binDir, "wintun.dll"))
    );
  }

  async start(serverHost: string): Promise<void> {
    if (process.platform !== "win32") {
      throw new Error("TUN bridge поддерживается только на Windows");
    }
    if (!TunController.available(this.binDir)) {
      throw new Error(`tun2socks.exe и/или wintun.dll не найдены в ${this.binDir}.`);
    }

    // 1) DNS-резолв ДО подъёма TUN
    this.serverIp = isIpAddress(serverHost)
      ? serverHost
      : (await dnsP.lookup(serverHost, { family: 4 })).address;

    // 2) Bypass: трафик к VPN-серверу идёт через оригинальный шлюз
    this.origGateway = await getDefaultGateway();
    if (!this.origGateway) {
      throw new Error("Не удалось определить default gateway");
    }
    console.log(`[tun] origGateway=${this.origGateway} serverIp=${this.serverIp}`);

    await runRoute([
      "ADD",
      this.serverIp,
      "MASK",
      "255.255.255.255",
      this.origGateway,
      "METRIC",
      "1",
    ]);

    // 3) Запуск tun2socks (wintun.dll загружается из cwd)
    const exe = path.join(this.binDir, "tun2socks.exe");
    this.proc = spawn(
      exe,
      [
        "-device",
        `tun://${TUN_NAME}`,
        "-proxy",
        `socks5://127.0.0.1:${SOCKS_PORT}`,
        "-loglevel",
        "info",
      ],
      {
        windowsHide: true,
        cwd: this.binDir,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    // Стримим логи tun2socks в консоль Electron — чтобы было видно ошибки
    this.proc.stdout?.on("data", (b: Buffer) => {
      process.stdout.write("[tun2socks] " + b.toString());
    });
    let lastStderr = "";
    this.proc.stderr?.on("data", (b: Buffer) => {
      const s = b.toString();
      lastStderr += s;
      if (lastStderr.length > 4000) lastStderr = lastStderr.slice(-4000);
      process.stderr.write("[tun2socks] " + s);
    });

    let exitedEarly = false;
    this.proc.once("exit", () => {
      this.proc = null;
      exitedEarly = true;
    });

    // 4) Ждём появления адаптера
    const idx = await waitForInterfaceIndex(TUN_NAME, 14);
    if (exitedEarly || !this.proc) {
      throw new Error(
        `tun2socks упал на старте: ${lastStderr.slice(-300).trim() || "no stderr"}`
      );
    }
    if (!idx) {
      await this.stop();
      throw new Error(`Адаптер "${TUN_NAME}" не появился. Проверьте wintun.dll.`);
    }
    this.ifIndex = idx;
    console.log(`[tun] adapter "${TUN_NAME}" up, ifIndex=${idx}`);

    // 5) Назначаем IP, gateway=none → шлюз пропишем отдельной командой route
    await runNetsh([
      "interface", "ipv4", "set", "address",
      `name=${TUN_NAME}`,
      "source=static",
      `addr=${TUN_ADDR}`,
      `mask=${TUN_MASK}`,
      "gateway=none",
    ]);

    // DNS на интерфейсе
    await runNetsh([
      "interface", "ipv4", "set", "dnsservers",
      `name=${TUN_NAME}`,
      "source=static",
      `addr=${TUN_DNS_PRIMARY}`,
      "register=primary",
      "validate=no",
    ]);
    await runNetsh([
      "interface", "ipv4", "add", "dnsservers",
      `name=${TUN_NAME}`,
      `addr=${TUN_DNS_SECONDARY}`,
      "index=2",
      "validate=no",
    ]).catch(() => {});

    // Метрика — пусть TUN будет предпочтительным
    await runNetsh([
      "interface", "ipv4", "set", "interface", TUN_NAME, "metric=1",
    ]).catch(() => {});

    // Отключаем IPv6 на адаптере, чтобы не было утечек/проблем
    await runNetsh([
      "interface", "ipv6", "set", "interface", TUN_NAME,
      "advertise=disabled", "forwarding=disabled",
    ]).catch(() => {});

    console.log(`[tun] addr=${TUN_ADDR}/${TUN_MASK} dns=${TUN_DNS_PRIMARY}`);

    // 6) Default route
    await runRoute([
      "ADD",
      "0.0.0.0",
      "MASK",
      "0.0.0.0",
      TUN_GATEWAY,
      "IF",
      String(idx),
      "METRIC",
      "1",
    ]);
    console.log(`[tun] default route 0.0.0.0/0 → ${TUN_GATEWAY} via IF ${idx}`);

    // Сбрасываем DNS-кэш
    await execFileP("ipconfig", ["/flushdns"], {
      windowsHide: true,
      encoding: "utf8",
    }).catch(() => {});
  }

  async stop(): Promise<void> {
    // 1) Снимаем default route (если ещё есть)
    try {
      await runRoute(["DELETE", "0.0.0.0", "MASK", "0.0.0.0", TUN_GATEWAY]);
    } catch {
      /* ignore */
    }

    // 2) Убиваем tun2socks
    if (this.proc) {
      const p = this.proc;
      this.proc = null;
      try {
        if (process.platform === "win32") {
          spawn("taskkill", ["/pid", String(p.pid), "/t", "/f"], { windowsHide: true });
        } else {
          p.kill("SIGTERM");
        }
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 500));
    }

    // 3) Bypass
    if (this.serverIp) {
      try {
        await runRoute(["DELETE", this.serverIp]);
      } catch {
        /* ignore */
      }
      this.serverIp = null;
    }
    this.origGateway = null;
    this.ifIndex = null;

    await execFileP("ipconfig", ["/flushdns"], {
      windowsHide: true,
      encoding: "utf8",
    }).catch(() => {});
  }
}

// ---------- утилиты ----------

async function runRoute(args: string[]): Promise<void> {
  try {
    const { stdout } = await execFileP("route", args, {
      windowsHide: true,
      encoding: "utf8",
    });
    const out = String(stdout).trim();
    if (out) console.log(`[route ${args.join(" ")}] ${out}`);
  } catch (e: any) {
    if (args[0] === "DELETE") return;
    const msg: string = e?.stderr || e?.message || String(e);
    if (/требуется|administrator|elevation|access is denied|отказано/i.test(msg)) {
      throw new Error(
        "Нет прав администратора. Запустите XThing от имени администратора."
      );
    }
    throw new Error(`route ${args.join(" ")}: ${msg.trim()}`);
  }
}

async function runNetsh(args: string[]): Promise<void> {
  try {
    const { stdout } = await execFileP("netsh", args, {
      windowsHide: true,
      encoding: "utf8",
    });
    const out = String(stdout).trim();
    if (out) console.log(`[netsh ${args.slice(0, 4).join(" ")}…] ${out}`);
  } catch (e: any) {
    const msg: string = e?.stderr || e?.message || String(e);
    if (/требуется|administrator|elevation|access is denied|отказано/i.test(msg)) {
      throw new Error("Нет прав администратора для netsh.");
    }
    throw new Error(`netsh ${args.join(" ")}: ${msg.trim()}`);
  }
}

async function getDefaultGateway(): Promise<string | null> {
  try {
    const { stdout } = await execFileP(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        "(Get-NetRoute -DestinationPrefix '0.0.0.0/0' -ErrorAction SilentlyContinue | Where-Object { $_.NextHop -ne '0.0.0.0' -and $_.InterfaceAlias -notlike 'XThing*' } | Sort-Object RouteMetric | Select-Object -First 1).NextHop",
      ],
      { windowsHide: true, encoding: "utf8" }
    );
    const ip = String(stdout).trim();
    return ip || null;
  } catch {
    return null;
  }
}

async function getInterfaceIndex(name: string): Promise<number | null> {
  try {
    const { stdout } = await execFileP(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `(Get-NetAdapter -Name "${name}" -ErrorAction SilentlyContinue).ifIndex`,
      ],
      { windowsHide: true, encoding: "utf8" }
    );
    const n = parseInt(String(stdout).trim(), 10);
    return Number.isNaN(n) ? null : n;
  } catch {
    return null;
  }
}

async function waitForInterfaceIndex(
  name: string,
  attempts: number
): Promise<number | null> {
  for (let i = 0; i < attempts; i++) {
    const idx = await getInterfaceIndex(name);
    if (idx) return idx;
    await new Promise((r) => setTimeout(r, 500));
  }
  return null;
}

function isIpAddress(s: string): boolean {
  return /^(\d{1,3}\.){3}\d{1,3}$/.test(s);
}
