import type { FastifyReply, FastifyRequest } from "fastify";

export async function requireAuth(req: FastifyRequest, reply: FastifyReply) {
  try {
    await (req as any).jwtVerify();
  } catch {
    return reply.code(401).send({ error: "Требуется авторизация" });
  }
}
