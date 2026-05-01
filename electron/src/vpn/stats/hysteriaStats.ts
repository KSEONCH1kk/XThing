import http from "node:http";

interface StatsSnapshot {
  bytesUp: number;
  bytesDown: number;
}

/**
 * Hysteria2 v2 экспонирует HTTP API с traffic stats, если в конфиге задан
 * блок `trafficStats: { listen: "127.0.0.1:port", secret: "..." }`.
 * GET /traffic — { tx: number, rx: number } для текущего клиента.
 * Подробнее: https://v2.hysteria.network/docs/advanced/Traffic-Stats-API/
 */
export function queryHysteriaStats(port: number, secret?: string): Promise<StatsSnapshot> {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        host: "127.0.0.1",
        port,
        path: "/traffic",
        headers: secret ? { Authorization: secret } : {},
        timeout: 1500,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => {
          if (!res.statusCode || res.statusCode >= 400) {
            return reject(new Error(`hysteria stats HTTP ${res.statusCode}`));
          }
          try {
            const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            // Формат: { "<connID>": { tx, rx } } или { tx, rx } в client-mode.
            // На клиенте — обычно { tx, rx } прямо.
            if (typeof body.tx === "number" && typeof body.rx === "number") {
              resolve({ bytesUp: body.tx, bytesDown: body.rx });
              return;
            }
            // Fallback: суммируем
            let tx = 0, rx = 0;
            for (const v of Object.values(body) as Array<{ tx?: number; rx?: number }>) {
              tx += v.tx ?? 0;
              rx += v.rx ?? 0;
            }
            resolve({ bytesUp: tx, bytesDown: rx });
          } catch (e) {
            reject(e);
          }
        });
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error("timeout"));
    });
    req.on("error", reject);
  });
}
