import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware.js";
import { broadcastTraffic } from "../ws.js";

const reportSchema = z.object({
  serverId: z.string().uuid().optional(),
  bytesUp: z.number().int().nonnegative(),
  bytesDown: z.number().int().nonnegative(),
});

export async function registerTrafficRoutes(app: FastifyInstance) {
  // Client / xray-hook periodic report
  app.post("/traffic/report", { preHandler: requireAuth }, async (req: any, reply) => {
    const p = reportSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    const { bytesUp, bytesDown, serverId } = p.data;
    const total = bytesUp + bytesDown;

    const r = await query<{ traffic_used: string; traffic_limit: string | null; expires_at: Date }>(
      `UPDATE subscriptions SET traffic_used = traffic_used + $1
       WHERE user_id = $2
       RETURNING traffic_used, traffic_limit, expires_at`,
      [total, req.user.sub]
    );
    const row = r.rows[0];
    if (!row) return reply.code(404).send({ error: "Подписка не найдена" });

    if (serverId) {
      await query(
        `INSERT INTO connection_history (user_id, server_id, bytes_up, bytes_down)
         VALUES ($1, $2, $3, $4)`,
        [req.user.sub, serverId, bytesUp, bytesDown]
      );
    }

    const used = Number(row.traffic_used);
    const limit = row.traffic_limit ? Number(row.traffic_limit) : null;
    const exhausted = limit !== null && used >= limit;

    broadcastTraffic(req.user.sub, { used, limit, exhausted });

    return { used, limit, exhausted };
  });
}
