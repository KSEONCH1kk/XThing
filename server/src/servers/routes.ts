import type { FastifyInstance } from "fastify";
import { query } from "../db.js";
import { requireAuth } from "../middleware.js";
import { getUserRouting } from "../routing/routes.js";

export async function registerServerRoutes(app: FastifyInstance) {
  app.get("/servers", { preHandler: requireAuth }, async () => {
    const r = await query<{
      id: string;
      name: string;
      country_code: string;
      city: string;
      protocol: string;
      load_percent: number;
    }>(
      `SELECT id, name, country_code, city, protocol, load_percent
       FROM servers WHERE enabled = TRUE
       ORDER BY load_percent ASC, name ASC`
    );
    return r.rows.map((row) => ({
      id: row.id,
      name: row.name,
      countryCode: row.country_code,
      city: row.city,
      protocol: row.protocol as "vless" | "hysteria2",
      loadPercent: row.load_percent,
    }));
  });

  app.get("/servers/:id/config", { preHandler: requireAuth }, async (req: any, reply) => {
    const id = req.params.id;
    // Active sub check
    const sub = await query<{ expires_at: Date; traffic_used: string; traffic_limit: string | null }>(
      `SELECT expires_at, traffic_used, traffic_limit FROM subscriptions WHERE user_id = $1`,
      [req.user.sub]
    );
    const s = sub.rows[0];
    if (!s || s.expires_at.getTime() < Date.now()) {
      return reply.code(403).send({ error: "Подписка не активна" });
    }
    if (s.traffic_limit !== null && BigInt(s.traffic_used) >= BigInt(s.traffic_limit)) {
      return reply.code(403).send({ error: "Трафик исчерпан", code: "TRAFFIC_EXHAUSTED" });
    }

    const r = await query<{
      protocol: string;
      address: string;
      port: number;
      config_payload: string;
    }>(
      `SELECT protocol, address, port, config_payload FROM servers
       WHERE id = $1 AND enabled = TRUE`,
      [id]
    );
    const row = r.rows[0];
    if (!row) return reply.code(404).send({ error: "Сервер не найден" });

    const routing = await getUserRouting(req.user.sub);

    return {
      protocol: row.protocol,
      address: row.address,
      port: row.port,
      payload: row.config_payload,
      routing,
    };
  });
}
