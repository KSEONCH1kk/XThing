import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../db.js";
import { requireAuth } from "../middleware.js";

const ruleSchema = z.object({
  kind: z.enum(["process", "ip", "domain", "regex"]),
  value: z.string().min(1).max(1024),
  action: z.enum(["proxy", "direct", "block"]),
  enabled: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function getUserRouting(userId: string) {
  const setting = await query<{ default_action: string }>(
    `SELECT default_action FROM user_routing WHERE user_id = $1`,
    [userId]
  );
  const rules = await query<{
    id: string;
    kind: string;
    value: string;
    action: string;
    sort_order: number;
    enabled: number | boolean;
  }>(
    `SELECT id, kind, value, action, sort_order, enabled
     FROM routing_rules
     WHERE user_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [userId]
  );
  return {
    defaultAction: (setting.rows[0]?.default_action ?? "proxy") as "proxy" | "direct",
    rules: rules.rows
      .filter((r) => !!r.enabled)
      .map((r) => ({
        id: r.id,
        kind: r.kind as "process" | "ip" | "domain" | "regex",
        value: r.value,
        action: r.action as "proxy" | "direct" | "block",
        sortOrder: r.sort_order,
      })),
  };
}

export async function registerRoutingRoutes(app: FastifyInstance) {
  app.get("/user/routing", { preHandler: requireAuth }, async (req: any) => {
    const setting = await query<{ default_action: string }>(
      `SELECT default_action FROM user_routing WHERE user_id = $1`,
      [req.user.sub]
    );
    const rules = await query<{
      id: string;
      kind: string;
      value: string;
      action: string;
      sort_order: number;
      enabled: number | boolean;
    }>(
      `SELECT id, kind, value, action, sort_order, enabled
       FROM routing_rules WHERE user_id = $1
       ORDER BY sort_order ASC, created_at ASC`,
      [req.user.sub]
    );
    return {
      defaultAction: setting.rows[0]?.default_action ?? "proxy",
      rules: rules.rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        value: r.value,
        action: r.action,
        sortOrder: r.sort_order,
        enabled: !!r.enabled,
      })),
    };
  });

  app.put("/user/routing/default", { preHandler: requireAuth }, async (req: any, reply) => {
    const body = z.object({ defaultAction: z.enum(["proxy", "direct"]) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    await query(
      `INSERT INTO user_routing (user_id, default_action) VALUES ($1, $2)
       ON CONFLICT(user_id) DO UPDATE SET default_action = excluded.default_action, updated_at = $3`,
      [req.user.sub, body.data.defaultAction, new Date().toISOString()]
    );
    return { ok: true };
  });

  app.post("/user/routing/rules", { preHandler: requireAuth }, async (req: any, reply) => {
    const p = ruleSchema.safeParse(req.body);
    if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
    const id = crypto.randomUUID();
    const order = p.data.sortOrder ?? 0;
    await query(
      `INSERT INTO routing_rules (id, user_id, kind, value, action, sort_order, enabled)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [id, req.user.sub, p.data.kind, p.data.value, p.data.action, order, p.data.enabled === false ? 0 : 1]
    );
    return { id };
  });

  app.patch("/user/routing/rules/:id", { preHandler: requireAuth }, async (req: any, reply) => {
    const body = ruleSchema.partial().safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    const updates: string[] = [];
    const params: any[] = [];
    let i = 1;
    if (body.data.kind !== undefined) { updates.push(`kind = $${i++}`); params.push(body.data.kind); }
    if (body.data.value !== undefined) { updates.push(`value = $${i++}`); params.push(body.data.value); }
    if (body.data.action !== undefined) { updates.push(`action = $${i++}`); params.push(body.data.action); }
    if (body.data.sortOrder !== undefined) { updates.push(`sort_order = $${i++}`); params.push(body.data.sortOrder); }
    if (body.data.enabled !== undefined) { updates.push(`enabled = $${i++}`); params.push(body.data.enabled ? 1 : 0); }
    if (!updates.length) return { ok: true };
    params.push(req.params.id, req.user.sub);
    await query(
      `UPDATE routing_rules SET ${updates.join(", ")} WHERE id = $${i++} AND user_id = $${i++}`,
      params
    );
    return { ok: true };
  });

  app.delete("/user/routing/rules/:id", { preHandler: requireAuth }, async (req: any) => {
    await query(`DELETE FROM routing_rules WHERE id = $1 AND user_id = $2`, [req.params.id, req.user.sub]);
    return { ok: true };
  });

  app.put("/user/routing/rules/order", { preHandler: requireAuth }, async (req: any, reply) => {
    const body = z.object({ ids: z.array(z.string()) }).safeParse(req.body);
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() });
    for (let i = 0; i < body.data.ids.length; i++) {
      await query(
        `UPDATE routing_rules SET sort_order = $1 WHERE id = $2 AND user_id = $3`,
        [i, body.data.ids[i], req.user.sub]
      );
    }
    return { ok: true };
  });
}
