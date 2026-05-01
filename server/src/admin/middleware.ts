import type { FastifyReply, FastifyRequest } from "fastify";
import { query } from "../db.js";

export async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  try {
    await (req as any).jwtVerify();
  } catch {
    return reply.code(401).send({ error: "Требуется авторизация" });
  }
  const sub = (req as any).user?.sub;
  if (!sub) return reply.code(401).send({ error: "Bad token" });
  const r = await query<{ is_admin: number | boolean }>(
    `SELECT is_admin FROM users WHERE id = $1`,
    [sub]
  );
  const isAdmin = !!r.rows[0]?.is_admin;
  if (!isAdmin) return reply.code(403).send({ error: "Доступ только администраторам" });
}
