import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../db.js";
import { encryptConfig } from "../crypto.js";
import { generateKey } from "../keys/service.js";
import { requireAdmin } from "./middleware.js";

export async function registerAdminRoutes(app: FastifyInstance) {
  // ---------- DASHBOARD ----------
  app.get("/admin/stats", { preHandler: requireAdmin }, async () => {
    const [users, subs, keysAll, keysUsed, servers, traffic] = await Promise.all([
      query<{ c: number | string }>(`SELECT COUNT(*) as c FROM users`),
      query<{ c: number | string }>(`SELECT COUNT(*) as c FROM subscriptions WHERE expires_at > $1`, [new Date().toISOString()]),
      query<{ c: number | string }>(`SELECT COUNT(*) as c FROM activation_keys`),
      query<{ c: number | string }>(`SELECT COUNT(*) as c FROM activation_keys WHERE used_by IS NOT NULL`),
      query<{ c: number | string }>(`SELECT COUNT(*) as c FROM servers WHERE enabled = 1 OR enabled = TRUE`),
      query<{ up: number | string | null; dn: number | string | null }>(
        `SELECT COALESCE(SUM(bytes_up),0) as up, COALESCE(SUM(bytes_down),0) as dn FROM connection_history`
      ),
    ]);

    // Точки графика — последние 14 дней по сумме трафика
    const sparklineRows = await query<{ d: string; up: number | string | null; dn: number | string | null }>(
      `SELECT substr(started_at, 1, 10) as d,
              COALESCE(SUM(bytes_up),0) as up,
              COALESCE(SUM(bytes_down),0) as dn
       FROM connection_history
       WHERE started_at > $1
       GROUP BY substr(started_at, 1, 10)
       ORDER BY d ASC`,
      [new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()]
    );

    return {
      users: Number(users.rows[0]?.c ?? 0),
      activeSubs: Number(subs.rows[0]?.c ?? 0),
      keys: {
        total: Number(keysAll.rows[0]?.c ?? 0),
        used: Number(keysUsed.rows[0]?.c ?? 0),
      },
      servers: Number(servers.rows[0]?.c ?? 0),
      traffic: {
        up: Number(traffic.rows[0]?.up ?? 0),
        down: Number(traffic.rows[0]?.dn ?? 0),
      },
      sparkline: sparklineRows.rows.map((r) => ({
        date: r.d,
        up: Number(r.up ?? 0),
        down: Number(r.dn ?? 0),
      })),
    };
  });

  // ---------- USERS ----------
  app.get("/admin/users", { preHandler: requireAdmin }, async (req: any) => {
    const limit = Math.min(Number(req.query?.limit ?? 50), 200);
    const offset = Math.max(Number(req.query?.offset ?? 0), 0);
    const r = await query<{
      id: string;
      email: string;
      is_admin: number | boolean;
      created_at: Date;
      plan_id: string | null;
      traffic_used: number | string | null;
      traffic_limit: number | string | null;
      expires_at: Date | null;
    }>(
      `SELECT u.id, u.email, u.is_admin, u.created_at,
              s.plan_id, s.traffic_used, s.traffic_limit, s.expires_at
       FROM users u LEFT JOIN subscriptions s ON s.user_id = u.id
       ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return r.rows.map((row) => ({
      id: row.id,
      email: row.email,
      isAdmin: !!row.is_admin,
      createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at ?? ""),
      planId: row.plan_id,
      trafficUsed: row.traffic_used !== null ? Number(row.traffic_used) : null,
      trafficLimit: row.traffic_limit !== null ? Number(row.traffic_limit) : null,
      expiresAt: row.expires_at instanceof Date ? row.expires_at.toISOString() : (row.expires_at ?? null),
    }));
  });

  app.patch("/admin/users/:id/admin", { preHandler: requireAdmin }, async (req: any, reply) => {
    const { id } = req.params;
    const body = z.object({ isAdmin: z.boolean() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    await query(`UPDATE users SET is_admin = $1 WHERE id = $2`, [body.data.isAdmin ? 1 : 0, id]);
    return { ok: true };
  });

  app.delete("/admin/users/:id", { preHandler: requireAdmin }, async (req: any, reply) => {
    const { id } = req.params;
    if (id === req.user.sub) return reply.code(400).send({ error: "Нельзя удалить себя" });
    await query(`DELETE FROM users WHERE id = $1`, [id]);
    return { ok: true };
  });

  // ---------- KEYS ----------
  app.get("/admin/keys", { preHandler: requireAdmin }, async (req: any) => {
    const limit = Math.min(Number(req.query?.limit ?? 100), 500);
    const offset = Math.max(Number(req.query?.offset ?? 0), 0);
    const r = await query<{
      id: string;
      plan_id: string;
      used_by: string | null;
      used_at: Date | null;
      created_at: Date;
      email: string | null;
    }>(
      `SELECT k.id, k.plan_id, k.used_by, k.used_at, k.created_at, u.email
       FROM activation_keys k LEFT JOIN users u ON u.id = k.used_by
       ORDER BY k.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
    return r.rows.map((k) => ({
      id: k.id,
      planId: k.plan_id,
      used: !!k.used_by,
      usedBy: k.email,
      usedAt: k.used_at instanceof Date ? k.used_at.toISOString() : (k.used_at ?? null),
      createdAt: k.created_at instanceof Date ? k.created_at.toISOString() : String(k.created_at ?? ""),
    }));
  });

  app.post("/admin/keys", { preHandler: requireAdmin }, async (req: any, reply) => {
    const body = z
      .object({
        planId: z.enum(["trial", "basic", "pro", "unlimited"]),
        count: z.number().int().min(1).max(100).default(1),
      })
      .safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const codes: string[] = [];
    for (let i = 0; i < body.data.count; i++) {
      codes.push(await generateKey(body.data.planId));
    }
    return { codes };
  });

  app.delete("/admin/keys/:id", { preHandler: requireAdmin }, async (req: any) => {
    await query(`DELETE FROM activation_keys WHERE id = $1 AND used_by IS NULL`, [req.params.id]);
    return { ok: true };
  });

  // ---------- SERVERS ----------
  app.get("/admin/servers", { preHandler: requireAdmin }, async () => {
    const r = await query<{
      id: string;
      name: string;
      country_code: string;
      city: string;
      protocol: string;
      address: string;
      port: number;
      load_percent: number;
      enabled: number | boolean;
      created_at: Date;
    }>(`SELECT id, name, country_code, city, protocol, address, port, load_percent, enabled, created_at
         FROM servers ORDER BY created_at DESC`);
    return r.rows.map((row) => ({
      id: row.id,
      name: row.name,
      countryCode: row.country_code,
      city: row.city,
      protocol: row.protocol,
      address: row.address,
      port: row.port,
      loadPercent: row.load_percent,
      enabled: !!row.enabled,
    }));
  });

  const serverInputSchema = z.object({
    name: z.string().min(1),
    countryCode: z.string().length(2),
    city: z.string().min(1),
    protocol: z.enum(["vless", "hysteria2"]),
    address: z.string().min(1),
    port: z.number().int().min(1).max(65535),
    params: z.record(z.any()),
    enabled: z.boolean().default(true),
    loadPercent: z.number().int().min(0).max(100).default(0),
  });

  app.post("/admin/servers", { preHandler: requireAdmin }, async (req: any, reply) => {
    const p = serverInputSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    const id = crypto.randomUUID();
    const payload = encryptConfig(JSON.stringify(p.data.params));
    await query(
      `INSERT INTO servers (id, name, country_code, city, protocol, address, port, config_payload, load_percent, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [
        id, p.data.name, p.data.countryCode, p.data.city, p.data.protocol,
        p.data.address, p.data.port, payload, p.data.loadPercent, p.data.enabled ? 1 : 0,
      ]
    );
    return { id };
  });

  app.put("/admin/servers/:id", { preHandler: requireAdmin }, async (req: any, reply) => {
    const p = serverInputSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    const payload = encryptConfig(JSON.stringify(p.data.params));
    await query(
      `UPDATE servers SET name=$1, country_code=$2, city=$3, protocol=$4, address=$5, port=$6,
              config_payload=$7, load_percent=$8, enabled=$9
       WHERE id=$10`,
      [
        p.data.name, p.data.countryCode, p.data.city, p.data.protocol,
        p.data.address, p.data.port, payload, p.data.loadPercent, p.data.enabled ? 1 : 0,
        req.params.id,
      ]
    );
    return { ok: true };
  });

  app.delete("/admin/servers/:id", { preHandler: requireAdmin }, async (req: any) => {
    await query(`DELETE FROM servers WHERE id = $1`, [req.params.id]);
    return { ok: true };
  });

  app.patch("/admin/servers/:id/enabled", { preHandler: requireAdmin }, async (req: any, reply) => {
    const body = z.object({ enabled: z.boolean() }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    await query(`UPDATE servers SET enabled = $1 WHERE id = $2`, [body.data.enabled ? 1 : 0, req.params.id]);
    return { ok: true };
  });
}
