import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().default(4000),
  // Можно начать без БД — по умолчанию используется SQLite-файл (Windows-friendly).
  // Поддерживаемые значения:
  //   sqlite:./data.db          — файл в server/
  //   sqlite::memory:           — in-memory (для тестов)
  //   postgres://user:pass@host/db
  DATABASE_URL: z.string().default("sqlite:./data.db"),
  // memory:// — in-process Redis-mock; иначе обычный ioredis.
  REDIS_URL: z.string().default("memory://"),
  JWT_ACCESS_SECRET: z.string().min(16).default("dev-access-secret-change-in-prod-please-32"),
  JWT_REFRESH_SECRET: z.string().min(16).default("dev-refresh-secret-change-in-prod-please-32"),
  JWT_ACCESS_TTL: z.coerce.number().default(900),
  JWT_REFRESH_TTL: z.coerce.number().default(60 * 60 * 24 * 30),
  // 64-hex по умолчанию — фиксированный dev-ключ. В проде ОБЯЗАТЕЛЬНО переопределить.
  SERVER_CONFIG_AES_KEY: z
    .string()
    .length(64, "must be 64 hex chars (32 bytes)")
    .default("db45cacca3f2628ca014cba4916b791471d8ddc0ced85f38ebc4496807096ebc"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;

export const dbDriver: "pg" | "sqlite" = env.DATABASE_URL.startsWith("sqlite:") ? "sqlite" : "pg";
export const useMemoryRedis = env.REDIS_URL.startsWith("memory:");
