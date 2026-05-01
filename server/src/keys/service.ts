import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { query, tx } from "../db.js";
import { randomKeyCode, sha256 } from "../crypto.js";

export type PlanId = "trial" | "basic" | "pro" | "unlimited";

export async function generateKey(plan: PlanId) {
  const code = randomKeyCode();
  const codeHash = await bcrypt.hash(code, 10);
  const lookup = sha256(code);
  const id = crypto.randomUUID();
  await query(
    `INSERT INTO activation_keys (id, code_hash, code_lookup, plan_id) VALUES ($1, $2, $3, $4)`,
    [id, codeHash, lookup, plan]
  );
  return code;
}

export async function getKeyInfo(code: string) {
  const lookup = sha256(code);
  const r = await query<{
    plan_id: PlanId;
    used_by: string | null;
    used_at: Date | null;
    title: string;
    traffic_bytes: string | number | null;
    duration_days: number;
  }>(
    `SELECT k.plan_id, k.used_by, k.used_at, p.title, p.traffic_bytes, p.duration_days
     FROM activation_keys k JOIN subscription_plans p ON p.id = k.plan_id
     WHERE k.code_lookup = $1`,
    [lookup]
  );
  return r.rows[0] ?? null;
}

/** Activate a key for a given user, creating or extending the subscription. */
export async function activateKeyForUser(code: string, userId: string) {
  const lookup = sha256(code);

  return tx(async (client) => {
    const k = await client.query<{
      id: string;
      code_hash: string;
      plan_id: PlanId;
      used_by: string | null;
      traffic_bytes: string | number | null;
      duration_days: number;
    }>(
      `SELECT k.id, k.code_hash, k.plan_id, k.used_by, p.traffic_bytes, p.duration_days
       FROM activation_keys k JOIN subscription_plans p ON p.id = k.plan_id
       WHERE k.code_lookup = $1`,
      [lookup]
    );

    const row = k.rows[0];
    if (!row) throw new KeyError("INVALID_KEY", "Ключ не найден");
    if (row.used_by) throw new KeyError("KEY_USED", "Ключ уже использован");

    const ok = await bcrypt.compare(code, row.code_hash);
    if (!ok) throw new KeyError("INVALID_KEY", "Ключ не найден");

    await client.query(
      `UPDATE activation_keys SET used_by = $1, used_at = $2 WHERE id = $3`,
      [userId, new Date().toISOString(), row.id]
    );

    const trafficLimit = row.traffic_bytes === null ? null : String(row.traffic_bytes);
    const durationMs = row.duration_days * 24 * 60 * 60 * 1000;
    const newExpiryFromNow = new Date(Date.now() + durationMs);

    const existing = await client.query<{
      plan_id: PlanId;
      traffic_limit: string | number | null;
      traffic_used: string | number;
      expires_at: Date;
    }>(
      `SELECT plan_id, traffic_limit, traffic_used, expires_at FROM subscriptions
       WHERE user_id = $1`,
      [userId]
    );

    if (existing.rowCount === 0) {
      const subId = crypto.randomUUID();
      await client.query(
        `INSERT INTO subscriptions (id, user_id, plan_id, traffic_limit, traffic_used, expires_at, activated_at)
         VALUES ($1, $2, $3, $4, 0, $5, $6)`,
        [
          subId,
          userId,
          row.plan_id,
          trafficLimit,
          newExpiryFromNow.toISOString(),
          new Date().toISOString(),
        ]
      );
    } else {
      const cur = existing.rows[0]!;
      const baseExpiry =
        cur.expires_at.getTime() > Date.now() ? cur.expires_at.getTime() : Date.now();
      const newExpiry = new Date(baseExpiry + durationMs);
      // Безлимит доминирует.
      const newLimit =
        trafficLimit === null || cur.traffic_limit === null
          ? null
          : (BigInt(cur.traffic_limit) + BigInt(trafficLimit)).toString();
      await client.query(
        `UPDATE subscriptions
         SET plan_id = $1, traffic_limit = $2, expires_at = $3, activated_at = $4
         WHERE user_id = $5`,
        [row.plan_id, newLimit, newExpiry.toISOString(), new Date().toISOString(), userId]
      );
    }

    return { planId: row.plan_id };
  });
}

export class KeyError extends Error {
  constructor(public code: "INVALID_KEY" | "KEY_USED", message: string) {
    super(message);
  }
}
