interface VlessParams {
  address: string;
  port: number;
  id: string;
  flow?: string;
  network?: string;
  security?: string;
  sni?: string;
  pbk?: string;
  sid?: string;
  fp?: string;
}

export type RuleKind = "process" | "ip" | "domain" | "regex";
export type RuleAction = "proxy" | "direct" | "block";

export interface RoutingRule {
  kind: RuleKind;
  value: string;
  action: RuleAction;
}

export interface UserRouting {
  defaultAction: "proxy" | "direct";
  rules: RoutingRule[];
}

const LOCAL_SOCKS_PORT = 10808;
const LOCAL_HTTP_PORT = 10809;
export const XRAY_API_PORT = 10085;

export function buildXrayConfig(p: VlessParams, routing?: UserRouting) {
  const stream: any = {
    network: p.network ?? "tcp",
    security: p.security ?? "reality",
  };
  if (stream.security === "reality") {
    stream.realitySettings = {
      serverName: p.sni ?? "www.cloudflare.com",
      publicKey: p.pbk ?? "",
      shortId: p.sid ?? "",
      fingerprint: p.fp ?? "chrome",
    };
  } else if (stream.security === "tls") {
    stream.tlsSettings = { serverName: p.sni ?? p.address };
  }

  return {
    log: { loglevel: "warning" },
    stats: {},
    api: { tag: "api", services: ["StatsService"] },
    policy: {
      system: {
        statsInboundUplink: true,
        statsInboundDownlink: true,
        statsOutboundUplink: true,
        statsOutboundDownlink: true,
      },
    },
    inbounds: [
      {
        tag: "api",
        listen: "127.0.0.1",
        port: XRAY_API_PORT,
        protocol: "dokodemo-door",
        settings: { address: "127.0.0.1" },
      },
      {
        tag: "socks-in",
        port: LOCAL_SOCKS_PORT,
        listen: "127.0.0.1",
        protocol: "socks",
        settings: { auth: "noauth", udp: true },
        sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] },
      },
      {
        tag: "http-in",
        port: LOCAL_HTTP_PORT,
        listen: "127.0.0.1",
        protocol: "http",
        sniffing: { enabled: true, destOverride: ["http", "tls", "quic"] },
      },
    ],
    outbounds: [
      {
        tag: "proxy",
        protocol: "vless",
        settings: {
          vnext: [
            {
              address: p.address,
              port: p.port,
              users: [{ id: p.id, encryption: "none", flow: p.flow ?? "xtls-rprx-vision" }],
            },
          ],
        },
        streamSettings: stream,
      },
      { tag: "direct", protocol: "freedom", settings: { domainStrategy: "UseIP" } },
      { tag: "block", protocol: "blackhole" },
    ],
    routing: buildRouting(routing),
  };
}

function buildRouting(r?: UserRouting) {
  const rules: any[] = [
    // API всегда отдельно
    { type: "field", inboundTag: ["api"], outboundTag: "api" },
    // Локальные сети — direct
    {
      type: "field",
      outboundTag: "direct",
      ip: ["geoip:private"],
    },
  ];

  if (r) {
    // Группируем правила по action+kind для эффективной матчинга
    const byKey = new Map<string, { domains: string[]; ips: string[]; processes: string[] }>();
    const keyOf = (action: string) => action;
    for (const rule of r.rules) {
      const key = keyOf(rule.action);
      let entry = byKey.get(key);
      if (!entry) {
        entry = { domains: [], ips: [], processes: [] };
        byKey.set(key, entry);
      }
      switch (rule.kind) {
        case "domain":
          entry.domains.push(translateDomain(rule.value));
          break;
        case "regex":
          entry.domains.push(`regexp:${rule.value}`);
          break;
        case "ip":
          entry.ips.push(rule.value);
          break;
        case "process":
          entry.processes.push(rule.value);
          break;
      }
    }

    for (const [action, entry] of byKey) {
      const tag = action === "proxy" ? "proxy" : action === "direct" ? "direct" : "block";
      if (entry.domains.length) {
        rules.push({ type: "field", outboundTag: tag, domain: entry.domains });
      }
      if (entry.ips.length) {
        rules.push({ type: "field", outboundTag: tag, ip: entry.ips });
      }
      if (entry.processes.length) {
        rules.push({ type: "field", outboundTag: tag, process_name: entry.processes });
      }
    }

    // Дефолтное действие как catch-all
    if (r.defaultAction === "direct") {
      rules.push({ type: "field", outboundTag: "direct", network: "tcp,udp" });
    }
  }

  // Базовая защита
  rules.push({ type: "field", outboundTag: "block", protocol: ["bittorrent"] });

  return { domainStrategy: "IPIfNonMatch", rules };
}

/**
 * "*.youtube.com" → "domain:youtube.com" (xray suffix-match)
 * "youtube.com"   → "domain:youtube.com"
 * "www.youtube.com" → "full:www.youtube.com" (точный матч)
 * "geosite:cn"    → "geosite:cn" (как есть)
 */
function translateDomain(v: string): string {
  if (v.startsWith("geosite:") || v.startsWith("regexp:") || v.startsWith("domain:") || v.startsWith("full:") || v.startsWith("keyword:")) {
    return v;
  }
  if (v.startsWith("*.")) return `domain:${v.slice(2)}`;
  if (v.includes("*")) return `regexp:${v.replace(/\./g, "\\.").replace(/\*/g, ".*")}`;
  // Эвристика: если есть www. или 3+ уровневый — full match. Иначе — suffix.
  const parts = v.split(".");
  if (parts.length >= 3 && parts[0] !== "") return `full:${v}`;
  return `domain:${v}`;
}
