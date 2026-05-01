package com.xthing.vpn;

import android.content.Context;
import android.util.Log;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Запускает tun2socks-бинарник (libtun2socks.so) и направляет пакеты из TUN
 * в локальный SOCKS5 (127.0.0.1:port).
 *
 * Совместим с двумя популярными tun2socks:
 *   - xjasonlyu/tun2socks: --tun fd:// --proxy socks5://127.0.0.1:1080 --mtu 1500 ...
 *   - badvpn-tun2socks: --tunfd <fd> --tunmtu 1500 --netif-ipaddr 10.0.0.1 ...
 *
 * Здесь — формат xjasonlyu (более современный, поддерживает udp).
 */
public class Tun2SocksRunner {
    private static final String TAG = "XThingTun2Socks";
    private final Context ctx;
    private final int tunFd;
    private final int socksPort;
    private final String tunIp;
    private final int mtu;
    private Process proc;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private Thread reader;

    public Tun2SocksRunner(Context ctx, int tunFd, int socksPort, String tunIp, int mtu) {
        this.ctx = ctx;
        this.tunFd = tunFd;
        this.socksPort = socksPort;
        this.tunIp = tunIp;
        this.mtu = mtu;
    }

    public void start() throws Exception {
        File bin = new File(ctx.getApplicationInfo().nativeLibraryDir, "libtun2socks.so");
        if (!bin.exists() || !bin.canExecute()) {
            throw new IllegalStateException("libtun2socks.so не найден в nativeLibraryDir");
        }
        List<String> args = new ArrayList<>();
        args.add(bin.getAbsolutePath());
        args.add("-device"); args.add("fd://" + tunFd);
        args.add("-proxy"); args.add("socks5://127.0.0.1:" + socksPort);
        args.add("-loglevel"); args.add("warning");
        args.add("-mtu"); args.add(String.valueOf(mtu));

        ProcessBuilder pb = new ProcessBuilder(args);
        pb.directory(ctx.getFilesDir());
        pb.redirectErrorStream(true);
        proc = pb.start();
        running.set(true);

        reader = new Thread(() -> {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(proc.getInputStream()))) {
                String line;
                while (running.get() && (line = br.readLine()) != null) {
                    Log.d(TAG, line);
                }
            } catch (Exception e) {
                if (running.get()) Log.w(TAG, "tun2socks stdout closed: " + e.getMessage());
            }
        }, "xthing-tun2socks-reader");
        reader.setDaemon(true);
        reader.start();
    }

    public void stop() {
        running.set(false);
        if (proc != null) {
            try { proc.destroy(); } catch (Exception ignored) {}
            try { proc.destroyForcibly(); } catch (Exception ignored) {}
        }
    }
}
