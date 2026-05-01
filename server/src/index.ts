import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import { dbDriver, env, useMemoryRedis } from "./env.js";
import { bootstrap as bootstrapDb } from "./db.js";
import { registerJwt } from "./auth/jwt.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { registerUserRoutes } from "./user/routes.js";
import { registerServerRoutes } from "./servers/routes.js";
import { registerKeyRoutes } from "./keys/routes.js";
import { registerTrafficRoutes } from "./traffic/routes.js";
import { registerAdminRoutes } from "./admin/routes.js";
import { registerRoutingRoutes } from "./routing/routes.js";
import { registerWs } from "./ws.js";
import { redis } from "./redis.js";

async function main() {
  console.log(`[xthing] booting… db=${dbDriver} redis=${useMemoryRedis ? "memory" : "real"} port=${env.PORT}`);
  await bootstrapDb();

  const app = Fastify({
    logger: { level: env.NODE_ENV === "production" ? "info" : "info" },
    disableRequestLogging: false,
  });

  // CORS_ORIGIN — CSV. Capacitor Android (androidScheme=https) грузит WebView
  // с origin "https://localhost", iOS — "capacitor://localhost", Vite dev —
  // "http://localhost:5173". Всё это должно совпасть со списком, иначе preflight
  // отшибает все cross-origin fetch'и из приложения.
  const corsOrigins = env.CORS_ORIGIN.split(",").map((s) => s.trim()).filter(Boolean);
  await app.register(cors, { origin: corsOrigins, credentials: true });
  await app.register(cookie);
  await app.register(rateLimit, {
    max: 200,
    timeWindow: "1 minute",
    ...(redis ? { redis, nameSpace: "xthing-rl:" } : {}),
  });
  await registerJwt(app);

  app.get("/", async () => ({
    name: "XThing API",
    version: "1.0.0",
    routes: [
      "GET  /health",
      "POST /auth/register",
      "POST /auth/login",
      "POST /auth/refresh",
      "POST /auth/logout",
      "GET  /user/me",
      "GET  /user/subscription",
      "GET  /user/traffic",
      "GET  /user/history",
      "GET  /servers",
      "GET  /servers/:id/config",
      "POST /keys/activate",
      "GET  /keys/info/:code",
      "POST /traffic/report",
      "WS   /ws/traffic",
    ],
  }));

  app.get("/health", async () => ({ ok: true, ts: Date.now() }));

  await registerAuthRoutes(app);
  await registerUserRoutes(app);
  await registerServerRoutes(app);
  await registerKeyRoutes(app);
  await registerTrafficRoutes(app);
  await registerAdminRoutes(app);
  await registerRoutingRoutes(app);
  await registerWs(app);

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
  console.log(`[xthing] ✓ listening on http://localhost:${env.PORT}`);
  console.log(`[xthing]   open http://localhost:${env.PORT}/health to verify`);
}

main().catch((e) => {
  console.error("[xthing] FATAL startup error:", e);
  process.exit(1);
});
