import path from "node:path";
import * as protoLoader from "@grpc/proto-loader";
import * as grpc from "@grpc/grpc-js";

let client: any | null = null;
let proto: any | null = null;

export function initXrayStatsClient(apiPort = 10085) {
  if (proto) return;
  const def = protoLoader.loadSync(path.join(__dirname, "xray.proto"), {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
  });
  const pkg = grpc.loadPackageDefinition(def) as any;
  proto = pkg.xray.app.stats.command.StatsService;
  client = new proto(`127.0.0.1:${apiPort}`, grpc.credentials.createInsecure());
}

export function disposeXrayStatsClient() {
  try {
    client?.close?.();
  } catch {
    /* ignore */
  }
  client = null;
}

interface StatsSnapshot {
  bytesUp: number;
  bytesDown: number;
}

export function queryXrayStats(): Promise<StatsSnapshot> {
  return new Promise((resolve, reject) => {
    if (!client) return reject(new Error("xray stats client not initialized"));
    // Pattern "outbound>>>proxy>>>traffic" покрывает uplink и downlink одного outbound тэга.
    client.QueryStats(
      { pattern: "outbound>>>proxy>>>traffic", reset: false },
      (err: Error | null, res: { stat?: { name: string; value: string }[] }) => {
        if (err) return reject(err);
        let bytesUp = 0;
        let bytesDown = 0;
        for (const s of res.stat ?? []) {
          // name has shape: outbound>>>proxy>>>traffic>>>uplink|downlink
          if (s.name.endsWith(">>>uplink")) bytesUp = Number(s.value) || 0;
          else if (s.name.endsWith(">>>downlink")) bytesDown = Number(s.value) || 0;
        }
        resolve({ bytesUp, bytesDown });
      }
    );
  });
}
