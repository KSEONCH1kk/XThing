/**
 * Парсеры серверных конфигураций.
 * Поддерживает:
 *   - vless://uuid@host:port?params#name
 *   - hysteria2://auth@host:port?params#name (и hy2:// синоним)
 *   - JSON: pure hysteria2 ({ server, auth, ... })
 *   - JSON: xray-style ({ outbounds: [...] }) с outbound proto vless / hysteria
 *
 * Возвращает нормализованный ParsedServer, готовый к подстановке в форму
 * админки.
 */

export interface ParsedServer {
  name?: string;
  countryCode?: string;
  city?: string;
  protocol: "vless" | "hysteria2";
  address: string;
  port: number;
  params: Record<string, any>;
}

/** Извлекает ISO-2 страну из flag-emoji в начале имени. */
export function extractCountry(name: string): { country?: string; cityHint?: string; clean: string } {
  const m = name.match(/^(\p{RI}\p{RI})\s*(.*)$/u);
  if (!m) return { clean: name };
  const flag = m[1] ?? "";
  const rest = (m[2] ?? "").trim();
  const A = 0x1f1e6;
  const a = "A".charCodeAt(0);
  const cps = [...flag];
  if (cps.length !== 2) return { clean: rest || name };
  const c1 = cps[0]!.codePointAt(0)!;
  const c2 = cps[1]!.codePointAt(0)!;
  const country = String.fromCharCode(a + (c1 - A)) + String.fromCharCode(a + (c2 - A));
  return { country, clean: rest };
}

function safeNum(v: any, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// ---------- URI ----------

function parseVlessUri(uri: string): ParsedServer | null {
  try {
    // vless — non-special scheme в WHATWG URL: host/username остаются пустыми,
    // всё уходит в pathname. Подменяем на https:, структура совпадает.
    if (!/^vless:\/\//i.test(uri)) return null;
    const normalized = uri.replace(/^vless:/i, "https:");
    const u = new URL(normalized);
    const id = decodeURIComponent(u.username || "");
    if (!id) return null;
    const address = u.hostname;
    const port = safeNum(u.port, 443);
    const p = u.searchParams;
    const security = p.get("security") || "tls";
    const sni = p.get("sni") || p.get("host") || "";

    const params: Record<string, any> = {
      id,
      flow: p.get("flow") || "",
      network: p.get("type") || "tcp",
      security,
    };
    if (sni) params.sni = sni;

    if (security === "reality") {
      params.pbk = p.get("pbk") || "";
      params.sid = p.get("sid") || "";
      params.fp = p.get("fp") || "chrome";
      const spx = p.get("spx");
      if (spx) params.spx = decodeURIComponent(spx);
    }

    const name = u.hash ? decodeURIComponent(u.hash.slice(1)) : undefined;
    return { name, protocol: "vless", address, port, params };
  } catch {
    return null;
  }
}

function parseHysteria2Uri(uri: string): ParsedServer | null {
  try {
    // URL не понимает кастомные схемы для парсинга userinfo, поэтому подменим
    // схему на https — структура та же.
    const normalized = uri.replace(/^(hysteria2|hy2):/i, "https:");
    const u = new URL(normalized);
    const auth = decodeURIComponent(u.username || "");
    if (!auth) return null;
    const address = u.hostname;
    const port = safeNum(u.port, 443);
    const p = u.searchParams;

    const obfsType = p.get("obfs");
    const obfsPwd = p.get("obfs-password") || p.get("obfsParam") || "";
    const params: Record<string, any> = {
      auth,
      tls: {
        sni: p.get("sni") || p.get("peer") || address,
        insecure: p.get("insecure") === "1" || p.get("insecure") === "true",
      },
    };
    if (obfsType) params.obfs = { type: obfsType, password: obfsPwd };

    const name = u.hash ? decodeURIComponent(u.hash.slice(1)) : undefined;
    return { name, protocol: "hysteria2", address, port, params };
  } catch {
    return null;
  }
}

// ---------- JSON ----------

function parseJsonConfig(text: string): ParsedServer | null {
  let obj: any;
  try {
    obj = JSON.parse(text);
  } catch {
    return null;
  }

  // Pure hysteria2 client config (apernet/hysteria2 v2 yaml-like)
  if (typeof obj.server === "string" && typeof obj.auth === "string") {
    const [host = "", portStr = ""] = obj.server.split(":");
    const params: Record<string, any> = { auth: obj.auth };
    if (obj.obfs) {
      const o = obj.obfs;
      params.obfs = {
        type: o.type,
        password: o.salamander?.password ?? o.password ?? "",
      };
    }
    if (obj.tls) {
      params.tls = {
        sni: obj.tls.sni,
        insecure: !!obj.tls.insecure,
      };
    } else {
      params.tls = { sni: host, insecure: false };
    }
    return {
      name: obj.remarks,
      protocol: "hysteria2",
      address: host,
      port: safeNum(portStr, 443),
      params,
    };
  }

  // Xray-style: либо весь конфиг, либо отдельный outbound объект
  let outbound: any = null;
  if (Array.isArray(obj.outbounds)) {
    outbound = obj.outbounds.find((o: any) => o.tag === "proxy") || obj.outbounds[0];
  } else if (obj.protocol && obj.settings) {
    outbound = obj;
  }
  if (!outbound) return null;

  const proto = outbound.protocol;

  if (proto === "vless") {
    const vnext = outbound.settings?.vnext?.[0];
    if (!vnext) return null;
    const user = vnext.users?.[0];
    if (!user?.id) return null;
    const stream = outbound.streamSettings || {};
    const reality = stream.realitySettings || {};
    const tls = stream.tlsSettings || {};
    const params: Record<string, any> = {
      id: user.id,
      flow: user.flow || "",
      network: stream.network || "tcp",
      security: stream.security || "tls",
    };
    if (stream.security === "reality") {
      params.pbk = reality.publicKey || "";
      params.sid = reality.shortId || "";
      params.fp = reality.fingerprint || "chrome";
      params.sni = reality.serverName || "";
    } else if (tls.serverName) {
      params.sni = tls.serverName;
    }
    return {
      name: obj.remarks,
      protocol: "vless",
      address: vnext.address,
      port: safeNum(vnext.port, 443),
      params,
    };
  }

  if (proto === "hysteria" || proto === "hysteria2") {
    const settings = outbound.settings || {};
    const stream = outbound.streamSettings || {};
    const hyConf = stream.hysteriaSettings || {};
    const tls = stream.tlsSettings || {};
    const params: Record<string, any> = {
      auth: hyConf.auth || settings.auth || "",
      tls: {
        sni: tls.serverName || tls.sni || settings.address || "",
        insecure: !!(tls.allowInsecure ?? tls.insecure ?? false),
      },
    };
    // Спец-блок 'finalmask' встречается в xray-fork с поддержкой hysteria
    const um = stream.finalmask?.udp?.[0];
    if (um) {
      params.obfs = { type: um.type, password: um.settings?.password ?? "" };
    } else if (stream.obfs) {
      params.obfs = {
        type: stream.obfs.type,
        password: stream.obfs.salamander?.password ?? stream.obfs.password ?? "",
      };
    }
    return {
      name: obj.remarks,
      protocol: "hysteria2",
      address: settings.address || "",
      port: safeNum(settings.port, 443),
      params,
    };
  }

  return null;
}

// ---------- Auto-detect ----------

/**
 * Автоопределение формата. Возвращает null если ничего не подошло.
 * Имя/страна/город дополнительно извлекаются из flag-emoji в начале имени.
 */
export function parseServer(input: string): ParsedServer | null {
  const text = input.trim();
  if (!text) return null;

  let parsed: ParsedServer | null = null;
  if (/^vless:\/\//i.test(text)) parsed = parseVlessUri(text);
  else if (/^(hysteria2|hy2):\/\//i.test(text)) parsed = parseHysteria2Uri(text);
  else if (text.startsWith("{") || text.startsWith("[")) parsed = parseJsonConfig(text);

  if (!parsed) return null;

  // Извлекаем страну/город из имени, если он есть
  if (parsed.name) {
    const ext = extractCountry(parsed.name);
    if (ext.country) parsed.countryCode = ext.country;
    parsed.name = ext.clean || parsed.name;
  }

  return parsed;
}
