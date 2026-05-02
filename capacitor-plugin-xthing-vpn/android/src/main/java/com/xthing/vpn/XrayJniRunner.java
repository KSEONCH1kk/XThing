package com.xthing.vpn;

import android.content.Context;
import android.util.Log;

import libv2ray.CoreCallbackHandler;
import libv2ray.CoreController;
import libv2ray.Libv2ray;

/**
 * Запускает xray-core IN-PROCESS через AndroidLibXrayLite (JNI).
 * Не спавнит дочерний процесс — всё работает внутри JVM.
 *
 * Использует API из github.com/2dust/AndroidLibXrayLite:
 *   Libv2ray.initCoreEnv(envPath, xudpKey)   — настройка окружения (asset / cert / xudp)
 *   Libv2ray.newCoreController(handler)      — создание контроллера
 *   controller.startLoop(configJson, tunFd)  — старт core
 *   controller.stopLoop()                    — стоп
 *   controller.queryStats(tag, direction)    — счётчик трафика, сбрасывает после чтения
 *
 * Параметр tunFd: если 0 — xray запускается без TUN (только SOCKS на 10808).
 * TUN на Android делаем отдельно через hev-socks5-tunnel, поэтому передаём 0.
 */
public class XrayJniRunner {
    private static final String TAG = "XThingXrayJni";

    private final Context ctx;
    private CoreController controller;
    private volatile boolean running = false;

    public XrayJniRunner(Context ctx) {
        this.ctx = ctx;
    }

    public void start(String configJson) throws Exception {
        // envPath нужен для geoip/geosite файлов и сертификатов;
        // мы их не используем сейчас, но передадим cacheDir чтобы не было крэша.
        Libv2ray.initCoreEnv(ctx.getCacheDir().getAbsolutePath(), "");

        controller = Libv2ray.newCoreController(new CoreCallbackHandler() {
            @Override public long startup() {
                Log.i(TAG, "[startup]");
                return 0;
            }
            @Override public long shutdown() {
                Log.i(TAG, "[shutdown]");
                return 0;
            }
            @Override public long onEmitStatus(long code, String msg) {
                Log.i(TAG, "[status " + code + "] " + msg);
                return 0;
            }
        });

        // tunFd=0 — xray не лезет в TUN, только поднимает SOCKS5 inbound.
        // TUN-маршрутизацию делает отдельный процесс hev-socks5-tunnel.
        controller.startLoop(configJson, 0);
        running = true;
    }

    public void stop() {
        if (controller != null && running) {
            try {
                controller.stopLoop();
            } catch (Exception e) {
                Log.w(TAG, "stopLoop error: " + e.getMessage());
            }
            running = false;
            controller = null;
        }
    }

    public boolean isRunning() {
        return running;
    }

    /**
     * Читает накопленный трафик и сбрасывает счётчик в xray.
     * tag = имя outbound (обычно "proxy"), direction = "uplink"/"downlink".
     */
    public long queryStats(String tag, String direction) {
        if (controller == null) return 0;
        try {
            return controller.queryStats(tag, direction);
        } catch (Exception e) {
            return 0;
        }
    }
}
