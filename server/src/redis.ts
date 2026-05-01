import { env, useMemoryRedis } from "./env.js";

// В dev (memory:// или REDIS_URL отсутствует) — отдаём `null`, и rate-limit
// работает на встроенном in-memory store. Это надёжнее, чем мокать ioredis API.
//
// В проде (redis://...) — поднимаем настоящий ioredis.

let _redis: any = null;

async function init() {
  if (useMemoryRedis) {
    console.log("[redis] in-memory mode (no Redis client)");
    return;
  }
  try {
    const Redis = (await import("ioredis")).default;
    _redis = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    _redis.on("error", (e: Error) => console.error("[redis]", e.message));
    console.log(`[redis] connected to ${env.REDIS_URL}`);
  } catch (e: any) {
    console.warn("[redis] не удалось подключиться, fallback на in-memory:", e?.message);
    _redis = null;
  }
}

await init();

export const redis = _redis;
