import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "./env.js";
import type { DbClient, QueryResult } from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;
  const url = env.DATABASE_URL.replace(/^sqlite:/, "");
  const target = url === ":memory:" ? ":memory:" : path.resolve(process.cwd(), url);
  db = new Database(target);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.defaultSafeIntegers(false); // BigInt-as-number — нам хватает
  return db;
}

/**
 * Транслируем pg-плейсхолдеры $1, $2 в ?, ?
 * (better-sqlite3 принимает только ?). Параметры остаются в том же порядке.
 *
 * Также подменяем Postgres-специфические выражения на SQLite-совместимые:
 *   NOW()                 → datetime('now')
 *   ON CONFLICT DO NOTHING → INSERT OR IGNORE (если применимо)
 */
function translate(sql: string): string {
  let out = sql.replace(/\$(\d+)/g, "?");
  out = out.replace(/\bNOW\(\)/gi, "datetime('now')");
  out = out.replace(/\bgen_random_uuid\(\)/gi, "lower(hex(randomblob(16)))");
  out = out.replace(/\bFOR UPDATE\b/gi, "");
  return out;
}

const DATE_KEY = /(?:_at|expires|started_at|ended_at)$/;

function postProcess<T>(rows: any[]): T[] {
  // SQLite даты читаются как строки → конвертируем в Date там, где это ожидается.
  for (const row of rows) {
    for (const k of Object.keys(row)) {
      if (DATE_KEY.test(k) && typeof row[k] === "string") {
        const d = new Date(row[k].replace(" ", "T") + (row[k].endsWith("Z") ? "" : "Z"));
        if (!isNaN(d.getTime())) row[k] = d;
      }
    }
  }
  return rows as T[];
}

function paramAdapt(p: unknown): unknown {
  if (p instanceof Date) return p.toISOString();
  if (typeof p === "boolean") return p ? 1 : 0;
  return p;
}

function runOne<T>(sql: string, params: unknown[]): QueryResult<T> {
  const d = getDb();
  const stmt = d.prepare(translate(sql));
  const adapted = params.map(paramAdapt);
  const head = sql.trim().slice(0, 8).toUpperCase();
  if (head.startsWith("SELECT") || /\bRETURNING\b/i.test(sql)) {
    const rows = stmt.all(...(adapted as any[]));
    return { rows: postProcess<T>(rows as any[]), rowCount: (rows as any[]).length };
  }
  const info = stmt.run(...(adapted as any[]));
  return { rows: [], rowCount: info.changes };
}

export async function query<T = any>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
  return runOne<T>(sql, params);
}

export async function tx<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  const d = getDb();
  d.exec("BEGIN IMMEDIATE");
  const client: DbClient = {
    async query<R = any>(sql: string, params: unknown[] = []): Promise<QueryResult<R>> {
      return runOne<R>(sql, params);
    },
  };
  try {
    const result = await fn(client);
    d.exec("COMMIT");
    return result;
  } catch (e) {
    try {
      d.exec("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw e;
  }
}

export async function bootstrap(): Promise<void> {
  const d = getDb();
  const existing = d
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
    .get();
  if (!existing) {
    const ddl = fs.readFileSync(path.join(__dirname, "schema.sqlite.sql"), "utf8");
    d.exec(ddl);
    console.log(`[db.sqlite] schema applied → ${env.DATABASE_URL.replace(/^sqlite:/, "")}`);
    return;
  }
  // Best-effort migrations
  try {
    d.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
    console.log("[db.sqlite] migration: users.is_admin added");
  } catch {}
  try {
    d.exec(`CREATE TABLE IF NOT EXISTS user_routing (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      default_action TEXT NOT NULL DEFAULT 'proxy' CHECK (default_action IN ('proxy','direct')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    d.exec(`CREATE TABLE IF NOT EXISTS routing_rules (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK (kind IN ('process','ip','domain','regex')),
      value TEXT NOT NULL,
      action TEXT NOT NULL CHECK (action IN ('proxy','direct','block')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    d.exec("CREATE INDEX IF NOT EXISTS idx_routing_user_sort ON routing_rules(user_id, sort_order)");
  } catch {}
}
