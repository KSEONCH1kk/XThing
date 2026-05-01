import { wsUrl } from "./client";

export type TrafficMessage = {
  type: "traffic";
  used: number;
  limit: number | null;
  exhausted: boolean;
};

type Listener = (msg: TrafficMessage) => void;

let socket: WebSocket | null = null;
let listeners: Set<Listener> = new Set();
let reconnectTimer: number | undefined;
let currentToken: string | null = null;

function open(token: string) {
  currentToken = token;
  try {
    socket?.close();
  } catch {}
  socket = new WebSocket(`${wsUrl}/ws/traffic?token=${encodeURIComponent(token)}`);
  socket.addEventListener("message", (e) => {
    try {
      const data = JSON.parse(e.data);
      if (data.type === "traffic") listeners.forEach((l) => l(data));
    } catch {
      /* ignore */
    }
  });
  socket.addEventListener("close", () => {
    if (currentToken) {
      reconnectTimer = window.setTimeout(() => open(currentToken!), 2000);
    }
  });
  socket.addEventListener("error", () => socket?.close());
}

export function connectTrafficWs(token: string) {
  open(token);
}

export function disconnectTrafficWs() {
  currentToken = null;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  socket?.close();
  socket = null;
}

export function onTraffic(cb: Listener) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
