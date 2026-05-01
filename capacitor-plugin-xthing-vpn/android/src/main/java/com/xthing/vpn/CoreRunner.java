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
 * Запускает бинарник xray / hysteria, упакованный в jniLibs (libxray.so / libhysteria.so).
 *
 * Размещение в jniLibs обязательно: только в этом каталоге Android позволяет
 * выполнять бинарник через exec() — SELinux запрещает запуск из data-каталога.
 */
public class CoreRunner {
    private static final String TAG = "XThingCoreRunner";
    private final Context ctx;
    private final String binName;       // "libxray.so" или "libhysteria.so"
    private final String protocol;      // "vless" / "hysteria2"
    private final String configPath;
    private Process proc;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private Thread readerThread;

    public CoreRunner(Context ctx, String binName, String protocol, String configPath) {
        this.ctx = ctx;
        this.binName = binName;
        this.protocol = protocol;
        this.configPath = configPath;
    }

    public void start() throws Exception {
        File bin = new File(ctx.getApplicationInfo().nativeLibraryDir, binName);
        if (!bin.exists() || !bin.canExecute()) {
            throw new IllegalStateException("Бинарник " + binName + " не найден в nativeLibraryDir или нет +x");
        }
        List<String> args = new ArrayList<>();
        args.add(bin.getAbsolutePath());
        if ("vless".equals(protocol)) {
            args.add("-c"); args.add(configPath);
        } else {
            args.add("client"); args.add("-c"); args.add(configPath);
        }
        ProcessBuilder pb = new ProcessBuilder(args);
        pb.directory(ctx.getFilesDir());
        pb.redirectErrorStream(true);
        proc = pb.start();
        running.set(true);

        readerThread = new Thread(() -> {
            try (BufferedReader br = new BufferedReader(new InputStreamReader(proc.getInputStream()))) {
                String line;
                while (running.get() && (line = br.readLine()) != null) {
                    Log.d(TAG, "[" + protocol + "] " + line);
                }
            } catch (Exception e) {
                if (running.get()) Log.w(TAG, "core stdout closed: " + e.getMessage());
            }
        }, "xthing-core-reader");
        readerThread.setDaemon(true);
        readerThread.start();
    }

    public void stop() {
        running.set(false);
        if (proc != null) {
            try { proc.destroy(); } catch (Exception ignored) {}
            try { proc.destroyForcibly(); } catch (Exception ignored) {}
        }
    }
}
