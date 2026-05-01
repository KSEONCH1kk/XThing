import type { FastifyInstance } from "fastify";
import websocket from "@fastify/websocket";
import { env } from "./env.js";

type Sock = { send: (data: string) => void };
const channels = new Map<string, Set<Sock>>();

export function broadcastTraffic(
  userId: string,
  payload: { used: number; limit: number | null; exhausted: boolean }
) {
  const subs = channels.get(userId);
  if (!subs) return;
  const msg = JSON.stringify({ type: "traffic", ...payload });
  for (const s of subs) {
    try {
      s.send(msg);
    } catch {
      /* ignore */
    }
  }
}

export async function registerWs(app: FastifyInstance) {
  await app.register(websocket);

  // В @fastify/websocket v10 первый аргумент handler-а — сам WebSocket,
  // а не обёртка с .socket. См. https://github.com/fastify/fastify-websocket
  app.get("/ws/traffic", { websocket: true }, (socket: any, req: any) => {
    const auth = req.headers["sec-websocket-protocol"] || (req.query as any)?.token;
    if (!auth) {
      socket.close(1008, "no token");
      return;
    }
    const token = String(auth).replace(/^Bearer\s+/, "");
    let userId: string;
    try {
      const decoded = app.jwt.verify<{ sub: string }>(token);
      userId = decoded.sub;
    } catch {
      socket.close(1008, "bad token");
      return;
    }

    const sock: Sock = { send: (d) => socket.send(d) };
    let set = channels.get(userId);
    if (!set) {
      set = new Set();
      channels.set(userId, set);
    }
    set.add(sock);

    socket.on("close", () => {
      set!.delete(sock);
      if (set!.size === 0) channels.delete(userId);
    });

    socket.send(JSON.stringify({ type: "hello", env: env.NODE_ENV }));
  });
}
