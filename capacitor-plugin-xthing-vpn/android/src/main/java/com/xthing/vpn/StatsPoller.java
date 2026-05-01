package com.xthing.vpn;

import android.content.Context;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.Socket;
import java.net.URL;
import java.util.function.BiConsumer;
import java.util.function.BooleanSupplier;

/**
 * Опрашивает stats:
 *   - hysteria2: HTTP GET http://127.0.0.1:10090/traffic (-H "Authorization: <secret>")
 *   - xray:    мини-gRPC HTTP/2 запрос QueryStats / TCP полу-ручная сборка фрейма.
 *
 * Так как полный grpc-java тянет 4+ МБ зависимостей, здесь делаем pragmatic:
 *  для xray поднимаем дополнительный stats inbound в формате `prometheus` (xray умеет это
 *  через `metrics: { tag: "metrics_out" }` + http inbound) или, как запасной путь —
 *  ProcessUtils читают встроенные stat-логи через `xray api statsquery` (внешний CLI).
 *
 * Минимальная и надёжная имплементация: запускаем `libxray.so api statsquery -pattern outbound>>>proxy>>>traffic`
 * (xray-core поддерживает CLI команду `api`), парсим вывод. Отдельных gRPC-зависимостей не нужно.
 */
public class StatsPoller {
    private static final String TAG = "XThingStats";
    private static final int HYSTERIA_PORT = 10090;
    private static final String HYSTERIA_SECRET = "xthing-stats";
    private static final int XRAY_API_PORT = 10085;

    private final Context ctx;
    private final String protocol;
    private final BooleanSupplier alive;
    private final BiConsumer<Long, Long> onStats;
    private Thread th;
    private volatile boolean stopped = false;

    public StatsPoller(Context ctx, String protocol, BooleanSupplier alive, BiConsumer<Long, Long> onStats) {
        this.ctx = ctx;
        this.protocol = protocol;
        this.alive = alive;
        this.onStats = onStats;
    }

    public void start() {
        th = new Thread(this::loop, "xthing-stats-poll");
        th.setDaemon(true);
        th.start();
    }

    public void stopPolling() {
        stopped = true;
        if (th != null) th.interrupt();
    }

    private void loop() {
        long up = 0, down = 0;
        while (!stopped && alive.getAsBoolean()) {
            try {
                long[] snap = "vless".equals(protocol) ? pollXray() : pollHysteria();
                up = snap[0];
                down = snap[1];
                onStats.accept(up, down);
            } catch (Exception e) {
                // тихо игнорируем — следующий тик попробует снова
            }
            try { Thread.sleep(1000); } catch (InterruptedException e) { break; }
        }
    }

    private long[] pollHysteria() throws Exception {
        URL url = new URL("http://127.0.0.1:" + HYSTERIA_PORT + "/traffic");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(1500);
        conn.setReadTimeout(1500);
        conn.setRequestProperty("Authorization", HYSTERIA_SECRET);
        try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
            StringBuilder sb = new StringBuilder();
            String line; while ((line = br.readLine()) != null) sb.append(line);
            JSONObject j = new JSONObject(sb.toString());
            // {"tx":..,"rx":..} или {"<id>":{"tx":..,"rx":..}}
            if (j.has("tx") && j.has("rx")) {
                return new long[] { j.getLong("tx"), j.getLong("rx") };
            }
            long tx = 0, rx = 0;
            java.util.Iterator<String> it = j.keys();
            while (it.hasNext()) {
                JSONObject v = j.getJSONObject(it.next());
                tx += v.optLong("tx", 0);
                rx += v.optLong("rx", 0);
            }
            return new long[] { tx, rx };
        }
    }

    /**
     * Используем xray CLI: `xray api statsquery -pattern outbound>>>proxy>>>traffic -server 127.0.0.1:10085`
     * Запускаем тот же `libxray.so` второй раз с CLI-аргументами и парсим JSON-ответ из stdout.
     */
    private long[] pollXray() throws Exception {
        java.io.File bin = new java.io.File(ctx.getApplicationInfo().nativeLibraryDir, "libxray.so");
        ProcessBuilder pb = new ProcessBuilder(
            bin.getAbsolutePath(), "api", "statsquery",
            "-server", "127.0.0.1:" + XRAY_API_PORT,
            "-pattern", "outbound>>>proxy>>>traffic"
        );
        pb.redirectErrorStream(true);
        Process p = pb.start();
        StringBuilder sb = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
            String line; while ((line = br.readLine()) != null) sb.append(line);
        }
        p.waitFor();
        // ответ JSON: { "stat": [ { "name": "...uplink", "value": "123" }, ... ] }
        long up = 0, down = 0;
        try {
            JSONObject j = new JSONObject(sb.toString());
            org.json.JSONArray arr = j.optJSONArray("stat");
            if (arr != null) {
                for (int i = 0; i < arr.length(); i++) {
                    JSONObject st = arr.getJSONObject(i);
                    String name = st.optString("name", "");
                    long val = st.optLong("value", 0);
                    if (name.endsWith(">>>uplink")) up = val;
                    else if (name.endsWith(">>>downlink")) down = val;
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "parse xray stats: " + e.getMessage());
        }
        return new long[] { up, down };
    }
}
