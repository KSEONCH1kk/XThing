/**
 * Стата с самого wintun-адаптера через Get-NetAdapterStatistics.
 * Работает для любого протокола (vless/hysteria), потому что считает
 * байты на уровне ОС — всё, что прошло через TUN.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileP = promisify(execFile);

export async function getAdapterStats(
  name: string
): Promise<{ bytesUp: number; bytesDown: number } | null> {
  if (process.platform !== "win32") return null;
  try {
    const { stdout } = await execFileP(
      "powershell",
      [
        "-NoProfile",
        "-Command",
        `$s = Get-NetAdapterStatistics -Name "${name}" -ErrorAction SilentlyContinue; ` +
          `if ($s) { Write-Output "$($s.SentBytes) $($s.ReceivedBytes)" }`,
      ],
      { windowsHide: true, encoding: "utf8" }
    );
    const out = String(stdout).trim();
    if (!out) return null;
    const parts = out.split(/\s+/);
    const sent = parseInt(parts[0] || "", 10);
    const recv = parseInt(parts[1] || "", 10);
    if (Number.isNaN(sent) || Number.isNaN(recv)) return null;
    return { bytesUp: sent, bytesDown: recv };
  } catch {
    return null;
  }
}
