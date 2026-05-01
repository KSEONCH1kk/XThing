import type { UserRouting, RoutingRule } from "./xray";

interface HysteriaParams {
  server: string;
  auth: string;
  obfs?: { type: string; password: string };
  tls?: { sni: string; insecure?: boolean };
  bandwidth?: { up: string; down: string };
}

const SOCKS_PORT = 10808;
const HTTP_PORT = 10809;
export const HYSTERIA_STATS_PORT = 10090;
export const HYSTERIA_STATS_SECRET = "xthing-stats";

export function buildHysteriaConfig(p: HysteriaParams, routing?: UserRouting) {
  const cfg: any = {
    server: p.server,
    auth: p.auth,
    tls: p.tls
      ? {
          sni: p.tls.sni,
          insecure: !!p.tls.insecure,
        }
      : undefined,
    obfs: p.obfs
      ? {
          type: p.obfs.type,
          salamander: { password: p.obfs.password },
        }
      : undefined,
    bandwidth: p.bandwidth ?? { up: "100 mbps", down: "200 mbps" },
    socks5: { listen: `127.0.0.1:${SOCKS_PORT}` },
    http: { listen: `127.0.0.1:${HTTP_PORT}` },
    trafficStats: {
      listen: `127.0.0.1:${HYSTERIA_STATS_PORT}`,
      secret: HYSTERIA_STATS_SECRET,
    },
    fastOpen: true,
    lazy: true,
  };

  if (routing) {
    const acl = buildAcl(routing);
    if (acl.length > 0) {
      cfg.acl = { inline: acl };
    }
  }

  return cfg;
}

/**
 * Hysteria2 v2 ACL formatters:
 *   direct(target)     — напрямую (минуя VPN)
 *   proxy(target)      — через VPN
 *   reject(target)     — block
 *
 * Targets:
 *   all
 *   suffix:youtube.com
 *   domain:www.youtube.com           (точное совпадение)
 *   cidr:10.0.0.0/8
 *   ip:8.8.8.8
 *   protocol filters: tcp, udp, tcp/443, udp/53 (через запятую)
 *
 * Регулярки и process_name hysteria НЕ поддерживает — такие правила пропускаем.
 *
 * См. https://v2.hysteria.network/docs/advanced/ACL/
 */
function buildAcl(routing: UserRouting): string[] {
  const lines: string[] = [];

  // Локальные сети — всегда напрямую
  for (const cidr of [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    "127.0.0.0/8",
    "169.254.0.0/16",
    "224.0.0.0/4",
  ]) {
    lines.push(`direct(cidr:${cidr})`);
  }

  for (const rule of routing.rules) {
    const action = mapAction(rule.action);
    const target = mapTarget(rule);
    if (target) lines.push(`${action}(${target})`);
  }

  lines.push(routing.defaultAction === "proxy" ? "proxy(all)" : "direct(all)");
  return lines;
}

function mapAction(a: RoutingRule["action"]): string {
  if (a === "proxy") return "proxy";
  if (a === "direct") return "direct";
  return "reject";
}

function mapTarget(rule: RoutingRule): string | null {
  switch (rule.kind) {
    case "domain": {
      const v = rule.value.trim();
      if (v.startsWith("suffix:") || v.startsWith("domain:")) return v;
      if (v.startsWith("full:")) return `domain:${v.slice(5)}`;
      if (v.startsWith("*.")) return `suffix:${v.slice(2)}`;
      if (v.includes("*")) return null; // wildcards шире звёздочки в начале — у hysteria только suffix
      // если содержит много точек (FQDN) — точное совпадение, иначе суффикс
      return v.split(".").length >= 3 ? `domain:${v}` : `suffix:${v}`;
    }
    case "ip": {
      const v = rule.value.trim();
      return v.includes("/") ? `cidr:${v}` : `ip:${v}`;
    }
    case "regex":
      // hysteria не поддерживает regex в ACL — пропускаем
      return null;
    case "process":
      // hysteria не поддерживает process_name — пропускаем
      return null;
  }
  return null;
}
