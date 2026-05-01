import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { activateKeyForUser, getKeyInfo, KeyError } from "./service.js";
import { requireAuth } from "../middleware.js";

const keyShape = z.object({
  key: z.string().regex(/^XTHING(-[A-Z0-9]{4}){3}$/),
});

export async function registerKeyRoutes(app: FastifyInstance) {
  app.post(
    "/keys/activate",
    { preHandler: requireAuth, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (req: any, reply) => {
      const p = keyShape.safeParse(req.body);
      if (!p.success) return reply.code(400).send({ error: p.error.flatten() });
      try {
        const r = await activateKeyForUser(p.data.key, req.user.sub);
        return { ok: true, planId: r.planId };
      } catch (e) {
        if (e instanceof KeyError) return reply.code(400).send({ error: e.message, code: e.code });
        throw e;
      }
    }
  );

  app.get("/keys/info/:code", { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async (req: any, reply) => {
    const code = req.params.code as string;
    if (!/^XTHING(-[A-Z0-9]{4}){3}$/.test(code)) {
      return reply.code(400).send({ error: "Неверный формат ключа" });
    }
    const info = await getKeyInfo(code);
    if (!info) return reply.code(404).send({ error: "Ключ не найден" });
    return {
      planId: info.plan_id,
      title: info.title,
      trafficBytes: info.traffic_bytes ? Number(info.traffic_bytes) : null,
      durationDays: info.duration_days,
      used: !!info.used_by,
    };
  });
}
