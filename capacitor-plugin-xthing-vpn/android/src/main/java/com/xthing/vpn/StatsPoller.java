package com.xthing.vpn;

import android.content.Context;
import android.util.Log;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.function.BiConsumer;
import java.util.function.BooleanSupplier;

/**
 * Опрашивает stats:
 *   - VLESS: xrayJni.queryStats("proxy", "uplink"/"downlink") — счётчик
 *     сбрасывается после чтения, поэтому аккумулируем дельты в total*.
 *   - Hysteria2: HTTP GET http://127.0.0.1:10090/traffic — возвращает уже
 *     накопленный total с момента старта.
 *
 * Никаких CLI exec — для VLESS читаем напрямую из in-process xray через JNI.
 */
public class StatsPoller {
    private static final String TAG = "XThingStats";
    private static final int HYSTERIA_PORT = 10090;
    private static final String HYSTERIA_SECRET = "xthing-stats";

    private final Context ctx;
    private final String protocol;
    private final XrayJniRunner xrayJni;
    private final BooleanSupplier alive;
    private final BiConsumer<Long, Long> onStats;
    private Thread th;
    private volatile boolean stopped = false;
    private long totalUp = 0;
    private long totalDown = 0;

    public StatsPoller(
        Context ctx,
        String protocol,
        XrayJniRunner xrayJni,
        BooleanSupplier alive,
        BiConsumer<Long, Long> onStats
    ) {
        this.ctx = ctx;
        this.protocol = protocol;
        this.xrayJni = xrayJni;
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
        while (!stopped && alive.getAsBoolean()) {
            try {
                long[] snap;
                if ("vless".equals(protocol)) {
                    snap = pollXrayJni();
                } else {
                    snap = pollHysteria();
                }
                onStats.accept(snap[0], snap[1]);
            } catch (Exception e) {
                /* тикни снова через секунду */
            }
            try { Thread.sleep(1000); } catch (InterruptedException e) { break; }
        }
    }

    /**
     * In-process чтение через AndroidLibXrayLite. queryStats возвращает
     * накопленную дельту И обнуляет счётчик, поэтому держим свой total*.
     */
    private long[] pollXrayJni() {
        if (xrayJni == null) return new long[] { totalUp, totalDown };
        long upDelta = xrayJni.queryStats("proxy", "uplink");
        long downDelta = xrayJni.queryStats("proxy", "downlink");
        if (upDelta > 0) totalUp += upDelta;
        if (downDelta > 0) totalDown += downDelta;
        return new long[] { totalUp, totalDown };
    }

    private long[] pollHysteria() throws Exception {
        URL url = new URL("http://127.0.0.1:" + HYSTERIA_PORT + "/traffic");
        HttpURLConnection conn = (HttpURLConnection) url.openConnection();
        conn.setConnectTimeout(1500);
        conn.setReadTimeout(1500);
        conn.setRequestProperty("Authorization", HYSTERIA_SECRET);
        try (BufferedReader br = new BufferedReader(new InputStreamReader(conn.getInputStream()))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) sb.append(line);
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
}
