import type { FastifyInstance } from "fastify";
import { query } from "../db.js";
import { requireAuth } from "../middleware.js";

export async function registerUserRoutes(app: FastifyInstance) {
  app.get("/user/me", { preHandler: requireAuth }, async (req: any) => {
    const r = await query<{ id: string; email: string; is_admin: number | boolean; created_at: Date }>(
      `SELECT id, email, is_admin, created_at FROM users WHERE id = $1`,
      [req.user.sub]
    );
    const row = r.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      isAdmin: !!row.is_admin,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ""),
    };
  });

  app.get("/user/subscription", { preHandler: requireAuth }, async (req: any) => {
    const r = await query<{
      plan_id: string;
      title: string;
      traffic_limit: string | null;
      traffic_used: string;
      expires_at: Date;
    }>(
      `SELECT s.plan_id, p.title, s.traffic_limit, s.traffic_used, s.expires_at
       FROM subscriptions s JOIN subscription_plans p ON p.id = s.plan_id
       WHERE s.user_id = $1`,
      [req.user.sub]
    );
    if (!r.rows[0]) return { active: false };
    const row = r.rows[0];
    return {
      active: row.expires_at.getTime() > Date.now(),
      planId: row.plan_id,
      title: row.title,
      trafficLimit: row.traffic_limit ? Number(row.traffic_limit) : null,
      trafficUsed: Number(row.traffic_used),
      expiresAt: row.expires_at.toISOString(),
    };
  });

  app.get("/user/traffic", { preHandler: requireAuth }, async (req: any) => {
    const r = await query<{ traffic_used: string; traffic_limit: string | null }>(
      `SELECT traffic_used, traffic_limit FROM subscriptions WHERE user_id = $1`,
      [req.user.sub]
    );
    const row = r.rows[0];
    if (!row) return { used: 0, limit: null };
    return {
      used: Number(row.traffic_used),
      limit: row.traffic_limit ? Number(row.traffic_limit) : null,
    };
  });

  app.get("/user/history", { preHandler: requireAuth }, async (req: any) => {
    const r = await query<{
      id: string;
      server_id: string | null;
      started_at: Date;
      ended_at: Date | null;
      bytes_up: string;
      bytes_down: string;
      server_name: string | null;
      country_code: string | null;
    }>(
      `SELECT h.id, h.server_id, h.started_at, h.ended_at, h.bytes_up, h.bytes_down,
              s.name AS server_name, s.country_code
       FROM connection_history h LEFT JOIN servers s ON s.id = h.server_id
       WHERE h.user_id = $1
       ORDER BY h.started_at DESC LIMIT 10`,
      [req.user.sub]
    );
    return r.rows.map((row) => ({
      id: String(row.id),
      serverId: row.server_id,
      serverName: row.server_name,
      countryCode: row.country_code,
      startedAt: row.started_at.toISOString(),
      endedAt: row.ended_at?.toISOString() ?? null,
      bytesUp: Number(row.bytes_up),
      bytesDown: Number(row.bytes_down),
    }));
  });
}
