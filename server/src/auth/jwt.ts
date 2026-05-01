import crypto from "node:crypto";
import jwt from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import { env } from "../env.js";
import { query } from "../db.js";

export type AccessClaims = { sub: string; email: string };

export async function registerJwt(app: FastifyInstance) {
  await app.register(jwt, {
    secret: env.JWT_ACCESS_SECRET,
    sign: { expiresIn: env.JWT_ACCESS_TTL },
  });
}

export function signRefresh(): { token: string; hash: string; expiresAt: Date } {
  const token = crypto.randomBytes(48).toString("base64url");
  const hash = crypto.createHash("sha256").update(token + env.JWT_REFRESH_SECRET).digest("hex");
  const expiresAt = new Date(Date.now() + env.JWT_REFRESH_TTL * 1000);
  return { token, hash, expiresAt };
}

export function verifyRefreshHash(token: string): string {
  return crypto.createHash("sha256").update(token + env.JWT_REFRESH_SECRET).digest("hex");
}

export async function persistRefresh(userId: string, hash: string, expiresAt: Date) {
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES ($1, $2, $3, $4)`,
    [id, userId, hash, expiresAt.toISOString()]
  );
}

export async function revokeRefresh(hash: string) {
  await query(`UPDATE refresh_tokens SET revoked = TRUE WHERE token_hash = $1`, [hash]);
}

export async function findRefresh(hash: string) {
  const r = await query<{ user_id: string; expires_at: Date; revoked: boolean }>(
    `SELECT user_id, expires_at, revoked FROM refresh_tokens WHERE token_hash = $1`,
    [hash]
  );
  return r.rows[0];
}
