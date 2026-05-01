import crypto from "node:crypto";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { query } from "../db.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  findRefresh,
  persistRefresh,
  revokeRefresh,
  signRefresh,
  verifyRefreshHash,
} from "./jwt.js";
import { activateKeyForUser, KeyError } from "../keys/service.js";
import { env } from "../env.js";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
  key: z.string().regex(/^XTHING(-[A-Z0-9]{4}){3}$/, "Неверный формат ключа"),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const refreshCookie = "xthing_rt";

function setRefreshCookie(reply: any, token: string) {
  // В проде клиент (Capacitor https://localhost, Electron app://, web
  // https://ccc.intave.tech) шлёт запросы cross-site → нужен SameSite=None,
  // что в свою очередь требует Secure. В dev (http) оставляем Lax.
  const isProd = env.NODE_ENV === "production";
  reply.setCookie(refreshCookie, token, {
    httpOnly: true,
    sameSite: isProd ? "none" : "lax",
    secure: isProd,
    path: "/auth",
    maxAge: env.JWT_REFRESH_TTL,
  });
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/auth/register", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (req, reply) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { email, password, key } = parsed.data;

    const exists = await query(`SELECT 1 FROM users WHERE email = $1`, [email]);
    if (exists.rowCount && exists.rowCount > 0) {
      return reply.code(409).send({ error: "Email уже зарегистрирован" });
    }

    const passwordHash = await hashPassword(password);
    const userId = crypto.randomUUID();
    // Первый зарегистрированный пользователь — администратор
    const userCount = await query<{ c: number | string }>(
      `SELECT COUNT(*) as c FROM users`
    );
    const firstUser = Number(userCount.rows[0]?.c ?? 0) === 0;
    await query(
      `INSERT INTO users (id, email, password_hash, is_admin) VALUES ($1, $2, $3, $4)`,
      [userId, email, passwordHash, firstUser ? 1 : 0]
    );

    try {
      await activateKeyForUser(key, userId);
    } catch (e) {
      // rollback user creation if key invalid
      await query(`DELETE FROM users WHERE id = $1`, [userId]);
      if (e instanceof KeyError) return reply.code(400).send({ error: e.message, code: e.code });
      throw e;
    }

    const access = await reply.jwtSign({ sub: userId, email });
    const r = signRefresh();
    await persistRefresh(userId, r.hash, r.expiresAt);
    setRefreshCookie(reply, r.token);
    return reply.send({ access, user: { id: userId, email } });
  });

  app.post("/auth/login", { config: { rateLimit: { max: 20, timeWindow: "1 minute" } } }, async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });
    const { email, password } = parsed.data;

    const r = await query<{ id: string; password_hash: string }>(
      `SELECT id, password_hash FROM users WHERE email = $1`,
      [email]
    );
    const u = r.rows[0];
    if (!u || !(await verifyPassword(password, u.password_hash))) {
      return reply.code(401).send({ error: "Неверный email или пароль" });
    }

    const access = await reply.jwtSign({ sub: u.id, email });
    const rt = signRefresh();
    await persistRefresh(u.id, rt.hash, rt.expiresAt);
    setRefreshCookie(reply, rt.token);
    return reply.send({ access, user: { id: u.id, email } });
  });

  app.post("/auth/refresh", async (req, reply) => {
    const token = (req as any).cookies?.[refreshCookie];
    if (!token) return reply.code(401).send({ error: "Нет refresh-токена" });
    const hash = verifyRefreshHash(token);
    const row = await findRefresh(hash);
    if (!row || row.revoked || row.expires_at.getTime() < Date.now()) {
      return reply.code(401).send({ error: "Refresh недействителен" });
    }
    const userQ = await query<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [row.user_id]);
    const email = userQ.rows[0]?.email;
    if (!email) return reply.code(401).send({ error: "Пользователь не найден" });

    // rotate
    await revokeRefresh(hash);
    const next = signRefresh();
    await persistRefresh(row.user_id, next.hash, next.expiresAt);
    setRefreshCookie(reply, next.token);
    const access = await reply.jwtSign({ sub: row.user_id, email });
    return reply.send({ access });
  });

  app.post("/auth/logout", async (req, reply) => {
    const token = (req as any).cookies?.[refreshCookie];
    if (token) {
      const hash = verifyRefreshHash(token);
      await revokeRefresh(hash);
    }
    const isProd = env.NODE_ENV === "production";
    reply.clearCookie(refreshCookie, {
      path: "/auth",
      sameSite: isProd ? "none" : "lax",
      secure: isProd,
    });
    return reply.send({ ok: true });
  });
}
