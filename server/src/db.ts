/**
 * DB facade. Маршрутизируем между двумя драйверами:
 *  - "sqlite" (better-sqlite3)  — для Windows/local dev без внешних зависимостей
 *  - "pg" (node-postgres)        — для прод
 *
 * Контракт: query<T>(sql, params) и tx(fn) возвращают одинаковую форму
 * { rows, rowCount }, чтобы остальной код не зависел от драйвера.
 *
 * Параметры всегда указываются в pg-стиле ($1, $2, ...). Для sqlite
 * происходит автоматическая трансляция на ?-плейсхолдеры.
 */
import { dbDriver } from "./env.js";

export interface QueryResult<T = any> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<T = any>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
}

interface Driver {
  query<T = any>(sql: string, params?: unknown[]): Promise<QueryResult<T>>;
  tx<T>(fn: (client: DbClient) => Promise<T>): Promise<T>;
  bootstrap(): Promise<void>;
}

let _driver: Driver | null = null;

async function getDriver(): Promise<Driver> {
  if (_driver) return _driver;
  _driver =
    dbDriver === "sqlite"
      ? ((await import("./db.sqlite.js")) as unknown as Driver)
      : ((await import("./db.pg.js")) as unknown as Driver);
  return _driver;
}

export async function query<T = any>(sql: string, params: unknown[] = []): Promise<QueryResult<T>> {
  const d = await getDriver();
  return d.query<T>(sql, params);
}

export async function tx<T>(fn: (client: DbClient) => Promise<T>): Promise<T> {
  const d = await getDriver();
  return d.tx<T>(fn);
}

export async function bootstrap(): Promise<void> {
  const d = await getDriver();
  await d.bootstrap();
}
