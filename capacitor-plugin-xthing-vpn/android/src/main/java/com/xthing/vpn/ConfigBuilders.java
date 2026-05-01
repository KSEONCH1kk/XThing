package com.xthing.vpn;

import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Зеркало electron/src/vpn/{xray,hysteria}.ts на Java —
 * чтобы конфиг для core-бинарника собирался идентично на десктопе и Android.
 */
public final class ConfigBuilders {
    private static final int LOCAL_SOCKS_PORT = 10808;
    private static final int LOCAL_HTTP_PORT = 10809;
    private static final int XRAY_API_PORT = 10085;
    private static final int HYSTERIA_STATS_PORT = 10090;
    private static final String HYSTERIA_STATS_SECRET = "xthing-stats";

    public static String buildXrayConfig(String address, int port, JSONObject p) throws Exception {
        JSONObject root = new JSONObject();
        root.put("log", new JSONObject().put("loglevel", "warning"));
        root.put("stats", new JSONObject());
        root.put("api", new JSONObject().put("tag", "api").put("services", new JSONArray().put("StatsService")));

        JSONObject sysPolicy = new JSONObject()
            .put("statsInboundUplink", true)
            .put("statsInboundDownlink", true)
            .put("statsOutboundUplink", true)
            .put("statsOutboundDownlink", true);
        root.put("policy", new JSONObject().put("system", sysPolicy));

        JSONArray inbounds = new JSONArray();
        inbounds.put(new JSONObject()
            .put("tag", "api").put("listen", "127.0.0.1").put("port", XRAY_API_PORT)
            .put("protocol", "dokodemo-door")
            .put("settings", new JSONObject().put("address", "127.0.0.1")));
        inbounds.put(new JSONObject()
            .put("tag", "socks-in").put("port", LOCAL_SOCKS_PORT).put("listen", "127.0.0.1")
            .put("protocol", "socks")
            .put("settings", new JSONObject().put("auth", "noauth").put("udp", true)));
        inbounds.put(new JSONObject()
            .put("tag", "http-in").put("port", LOCAL_HTTP_PORT).put("listen", "127.0.0.1")
            .put("protocol", "http"));
        root.put("inbounds", inbounds);

        JSONObject stream = new JSONObject()
            .put("network", p.optString("network", "tcp"))
            .put("security", p.optString("security", "reality"));
        if ("reality".equals(stream.getString("security"))) {
            stream.put("realitySettings", new JSONObject()
                .put("serverName", p.optString("sni", "www.cloudflare.com"))
                .put("publicKey", p.optString("pbk", ""))
                .put("shortId", p.optString("sid", ""))
                .put("fingerprint", p.optString("fp", "chrome")));
        } else if ("tls".equals(stream.getString("security"))) {
            stream.put("tlsSettings", new JSONObject().put("serverName", p.optString("sni", address)));
        }

        JSONObject vlessOut = new JSONObject()
            .put("tag", "proxy").put("protocol", "vless")
            .put("settings", new JSONObject().put("vnext", new JSONArray().put(
                new JSONObject()
                    .put("address", address).put("port", port)
                    .put("users", new JSONArray().put(
                        new JSONObject()
                            .put("id", p.optString("id"))
                            .put("encryption", "none")
                            .put("flow", p.optString("flow", "xtls-rprx-vision"))
                    ))
            )))
            .put("streamSettings", stream);

        JSONArray outbounds = new JSONArray();
        outbounds.put(vlessOut);
        outbounds.put(new JSONObject().put("tag", "direct").put("protocol", "freedom"));
        outbounds.put(new JSONObject().put("tag", "block").put("protocol", "blackhole"));
        root.put("outbounds", outbounds);

        JSONArray rules = new JSONArray();
        rules.put(new JSONObject().put("type", "field").put("inboundTag", new JSONArray().put("api")).put("outboundTag", "api"));
        rules.put(new JSONObject().put("type", "field").put("outboundTag", "block").put("protocol", new JSONArray().put("bittorrent")));
        root.put("routing", new JSONObject().put("domainStrategy", "AsIs").put("rules", rules));
        return root.toString();
    }

    public static String buildHysteriaConfig(String address, int port, JSONObject p) throws Exception {
        JSONObject root = new JSONObject();
        root.put("server", address + ":" + port);
        root.put("auth", p.optString("auth"));
        if (p.has("tls")) {
            JSONObject t = p.getJSONObject("tls");
            root.put("tls", new JSONObject()
                .put("sni", t.optString("sni"))
                .put("insecure", t.optBoolean("insecure", false)));
        }
        if (p.has("obfs")) {
            JSONObject o = p.getJSONObject("obfs");
            root.put("obfs", new JSONObject()
                .put("type", o.optString("type"))
                .put("salamander", new JSONObject().put("password", o.optString("password"))));
        }
        root.put("bandwidth", new JSONObject()
            .put("up", "100 mbps").put("down", "200 mbps"));
        root.put("socks5", new JSONObject().put("listen", "127.0.0.1:" + LOCAL_SOCKS_PORT));
        root.put("http", new JSONObject().put("listen", "127.0.0.1:" + LOCAL_HTTP_PORT));
        root.put("trafficStats", new JSONObject()
            .put("listen", "127.0.0.1:" + HYSTERIA_STATS_PORT)
            .put("secret", HYSTERIA_STATS_SECRET));
        root.put("fastOpen", true);
        root.put("lazy", true);
        return root.toString();
    }

    private ConfigBuilders() {}
}
