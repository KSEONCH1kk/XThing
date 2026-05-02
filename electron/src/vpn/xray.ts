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
  spx?: string;
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
      // spiderX (URI param `spx`) — путь, который reality-клиент использует
      // для масквирующего HTTPS-запроса при handshake'е. Дефолт xray = "/".
      spiderX: p.spx ?? "/",
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

// Список private/loopback/link-local сетей. Раньше использовали алиас
// xray-core "geoip:private", но он требует geoip.dat рядом с xray.exe —
// если файла нет, процесс падает с GetFileAttributesEx geoip.dat.
const PRIVATE_CIDR = [
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "::1/128",
  "fc00::/7",
  "fe80::/10",
];

function buildRouting(r?: UserRouting) {
  const rules: any[] = [
    // API всегда отдельно
    { type: "field", inboundTag: ["api"], outboundTag: "api" },
    // Локальные сети — direct
    {
      type: "field",
      outboundTag: "direct",
      ip: PRIVATE_CIDR,
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
          // geoip:* требует geoip.dat — пропускаем такие правила (см. коммент
          // выше про geosite). Обычные CIDR/IP — пропускаем как есть.
          if (rule.value.startsWith("geoip:")) {
            console.warn("[xray] правило", rule.value, "пропущено — geoip.dat не поставляется в bin/");
          } else {
            entry.ips.push(rule.value);
          }
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
  // geosite:* требует geosite.dat в папке xray. Если файла нет, xray-core
  // падает на старте. Игнорируем — пользователь увидит правило в админке,
  // но в рантайме оно молча будет домен-suffix'ом без geo-эффекта.
  if (v.startsWith("geosite:")) {
    console.warn("[xray] правило", v, "пропущено — geosite.dat не поставляется в bin/");
    return `domain:${v.slice("geosite:".length)}`;
  }
  if (v.startsWith("regexp:") || v.startsWith("domain:") || v.startsWith("full:") || v.startsWith("keyword:")) {
    return v;
  }
  if (v.startsWith("*.")) return `domain:${v.slice(2)}`;
  if (v.includes("*")) return `regexp:${v.replace(/\./g, "\\.").replace(/\*/g, ".*")}`;
  // Эвристика: если есть www. или 3+ уровневый — full match. Иначе — suffix.
  const parts = v.split(".");
  if (parts.length >= 3 && parts[0] !== "") return `full:${v}`;
  return `domain:${v}`;
}
