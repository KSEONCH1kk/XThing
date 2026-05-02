package com.xthing.vpn;

import android.content.Context;
import android.util.Log;

import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Запускает hev-socks5-tunnel ВНУТРИ процесса через JNI.
 *
 * libhev-socks5-tunnel.so — это shared library (а не standalone exe),
 * с встроенным jni-шимом. Вызываем nativeMain() в отдельном потоке —
 * она блокируется до nativeQuit().
 *
 * Конфиг — YAML, пишем во временный файл и передаём путь.
 */
public class HevTunRunner {
    private static final String TAG = "XThingHevTun";
    private static final int SOCKS_PORT = 10808;

    private final Context ctx;
    private final int tunFd;
    private final int mtu;
    private Thread workThread;
    private final AtomicBoolean running = new AtomicBoolean(false);

    public HevTunRunner(Context ctx, int tunFd, int mtu) {
        this.ctx = ctx;
        this.tunFd = tunFd;
        this.mtu = mtu;
    }

    public void start() throws Exception {
        File configFile = writeConfig();

        workThread = new Thread(() -> {
            running.set(true);
            try {
                Log.i(TAG, "nativeMain start (configPath=" + configFile + ", fd=" + tunFd + ")");
                int rc = HevSocks5Tunnel.nativeMain(configFile.getAbsolutePath(), tunFd);
                Log.i(TAG, "nativeMain returned " + rc);
            } catch (Throwable t) {
                Log.e(TAG, "nativeMain crashed", t);
            } finally {
                running.set(false);
            }
        }, "xthing-hevtun");
        workThread.setDaemon(true);
        workThread.start();
    }

    public void stop() {
        if (running.get()) {
            try {
                HevSocks5Tunnel.nativeQuit();
            } catch (Throwable t) {
                Log.w(TAG, "quit error", t);
            }
        }
        if (workThread != null) {
            try {
                workThread.join(2000);
            } catch (InterruptedException ignored) {}
            workThread = null;
        }
    }

    public boolean isRunning() {
        return running.get();
    }

    /**
     * Статистика адаптера: { tx_packets, tx_bytes, rx_packets, rx_bytes }.
     * Стоит учитывать что tx == «вверх» (исходящий трафик клиента),
     * rx == «вниз» (входящий).
     */
    public long[] stats() {
        try {
            return HevSocks5Tunnel.nativeStats();
        } catch (Throwable t) {
            return new long[] { 0, 0, 0, 0 };
        }
    }

    private File writeConfig() throws Exception {
        File f = new File(ctx.getCacheDir(), "hev-tunnel.yaml");
        // Без tunnel.ipv4 ряд сборок hev падают в null-deref внутри lwIP,
        // даже если fd передан явно — даём ему любую частную сеть.
        String yaml =
            "tunnel:\n" +
            "  name: xthing\n" +
            "  mtu: " + mtu + "\n" +
            "  ipv4: 198.18.0.1\n" +
            "socks5:\n" +
            "  port: " + SOCKS_PORT + "\n" +
            "  address: 127.0.0.1\n" +
            "  udp: udp\n" +
            "misc:\n" +
            "  log-level: warn\n";
        try (FileOutputStream fos = new FileOutputStream(f)) {
            fos.write(yaml.getBytes("UTF-8"));
        }
        return f;
    }
}
