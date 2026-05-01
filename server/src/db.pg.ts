import pg from "pg";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";
import type { DbClient, QueryResult } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let pool: pg.Pool | null = null;
function getPool(): pg.Pool {
  if (!pool) {
    pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 10 });
  }
  return pool;
}

export async function query<T = any>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const r = await getPool().query<any>(sql, params as any[]);
  return { rows: r.rows as T[], rowCount: r.rowCount ?? 0 };
}

export async function tx<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const wrapped: DbClient = {
      async query<R = any>(sql: string, params: unknown[] = []): Promise<QueryResult<R>> {
        const r = await client.query<any>(sql, params as any[]);
        return { rows: r.rows as R[], rowCount: r.rowCount ?? 0 };
      },
    };
    const result = await fn(wrapped);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function bootstrap(): Promise<void> {
  const r = await getPool().query("SELECT to_regclass('public.users') AS exists");
  if (!r.rows[0]?.exists) {
    const ddl = fs.readFileSync(path.join(__dirname, "schema.pg.sql"), "utf8");
    await getPool().query(ddl);
    console.log("[db.pg] schema applied");
    return;
  }
  // Best-effort миграции
  try {
    await getPool().query(
      "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE"
    );
    await getPool().query(`CREATE TABLE IF NOT EXISTS user_routing (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      default_action TEXT NOT NULL DEFAULT 'proxy' CHECK (default_action IN ('proxy','direct')),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await getPool().query(`CREATE TABLE IF NOT EXISTS routing_rules (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('process','ip','domain','regex')),
      value TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('proxy','direct','block')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    await getPool().query("CREATE INDEX IF NOT EXISTS idx_routing_user_sort ON routing_rules(user_id, sort_order)");
  } catch {
    /* ignore */
  }
}
