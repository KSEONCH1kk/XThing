package com.xthing.vpn;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import org.json.JSONObject;

import java.io.File;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Системный VPN-сервис XThing.
 *
 * Архитектура:
 *   1. Устанавливаем TUN через VpnService.Builder (setMtu, addAddress, addRoute, addDnsServer).
 *   2. Стартуем xray-core или hysteria2 (бинарники из jniLibs) на 127.0.0.1:10808 (SOCKS5).
 *   3. Стартуем tun2socks (тоже бинарник из jniLibs), направляем TUN → SOCKS5.
 *   4. Периодически читаем stats (gRPC у xray, HTTP у hysteria) и шлём через broadcast.
 */
public class XThingVpnService extends VpnService {

    public static final String ACTION_CONNECT = "com.xthing.vpn.CONNECT";
    public static final String ACTION_DISCONNECT = "com.xthing.vpn.DISCONNECT";

    private static final String TAG = "XThingVpn";
    private static final String NOTIFY_CHANNEL = "xthing-vpn";
    private static final int NOTIFY_ID = 4242;

    private static final String VPN_ADDR = "10.0.0.2";
    private static final String VPN_DNS = "1.1.1.1";
    private static final int VPN_MTU = 1500;
    private static final int SOCKS_PORT = 10808;

    private ParcelFileDescriptor tunPfd;
    private CoreRunner coreRunner;
    private Tun2SocksRunner tunRunner;
    private StatsPoller statsPoller;
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicLong bytesUp = new AtomicLong(0);
    private final AtomicLong bytesDown = new AtomicLong(0);

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            return START_NOT_STICKY;
        }
        if (ACTION_DISCONNECT.equals(intent.getAction())) {
            tearDown("idle", null);
            stopSelf();
            return START_NOT_STICKY;
        }

        if (!ACTION_CONNECT.equals(intent.getAction())) {
            return START_NOT_STICKY;
        }
        if (running.get()) {
            // повторный CONNECT — переоткрываемся
            tearDown("disconnecting", null);
        }

        startForeground(NOTIFY_ID, buildNotification("Подключение…"));
        emitStatus("connecting", null);

        String protocol = intent.getStringExtra("protocol");
        String address = intent.getStringExtra("address");
        int port = intent.getIntExtra("port", 0);
        String payload = intent.getStringExtra("payload");

        try {
            establishTun();
            startCoreAndTunBridge(protocol, address, port, payload);
            running.set(true);
            updateNotification("Подключено");
            emitStatus("connected", null);
            statsPoller = new StatsPoller(this, protocol, () -> running.get(), (up, down) -> {
                bytesUp.set(up);
                bytesDown.set(down);
                emitStats(up, down);
            });
            statsPoller.start();
        } catch (Exception e) {
            Log.e(TAG, "connect failed", e);
            tearDown("error", e.getMessage());
            stopSelf();
        }
        return START_STICKY;
    }

    private void establishTun() throws Exception {
        Builder b = new Builder()
            .setSession("XThing VPN")
            .setMtu(VPN_MTU)
            .addAddress(VPN_ADDR, 24)
            .addRoute("0.0.0.0", 0)
            .addDnsServer(VPN_DNS)
            .allowFamily(android.system.OsConstants.AF_INET);

        // Исключаем сам пакет, чтобы трафик плагина не зацикливался
        try {
            b.addDisallowedApplication(getPackageName());
        } catch (Exception ignored) {}

        tunPfd = b.establish();
        if (tunPfd == null) {
            throw new IllegalStateException("VpnService.Builder.establish() вернул null");
        }
    }

    private void startCoreAndTunBridge(String protocol, String address, int port, String payload) throws Exception {
        // 1) собрать конфиг файл во внутренней директории
        File cfgDir = new File(getFilesDir(), "vpn");
        if (!cfgDir.exists()) cfgDir.mkdirs();
        File cfgFile = new File(cfgDir, protocol + ".json");
        JSONObject params = new JSONObject(payload);
        String coreCfg;
        if ("vless".equals(protocol)) {
            coreCfg = ConfigBuilders.buildXrayConfig(address, port, params);
        } else {
            coreCfg = ConfigBuilders.buildHysteriaConfig(address, port, params);
        }
        writeFile(cfgFile, coreCfg);

        // 2) запустить core (xray / hysteria) — спавним как exec
        String coreBin = "vless".equals(protocol) ? "libxray.so" : "libhysteria.so";
        coreRunner = new CoreRunner(this, coreBin, protocol, cfgFile.getAbsolutePath());
        coreRunner.start();

        // 3) запустить tun2socks: pipe TUN <-> 127.0.0.1:10808
        tunRunner = new Tun2SocksRunner(this, tunPfd.getFd(), SOCKS_PORT, VPN_ADDR, VPN_MTU);
        tunRunner.start();
    }

    private void tearDown(String finalState, String error) {
        running.set(false);
        if (statsPoller != null) statsPoller.stopPolling();
        if (tunRunner != null) tunRunner.stop();
        if (coreRunner != null) coreRunner.stop();
        if (tunPfd != null) {
            try { tunPfd.close(); } catch (Exception ignored) {}
            tunPfd = null;
        }
        emitStatus(finalState, error);
        try { stopForeground(STOP_FOREGROUND_REMOVE); } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        tearDown("idle", null);
        super.onDestroy();
    }

    @Override
    public void onRevoke() {
        // Пользователь отозвал VPN-разрешение / другая VPN-сессия
        tearDown("idle", "Сессия отозвана системой");
        stopSelf();
    }

    // ---------- helpers ----------

    private void emitStatus(String state, String error) {
        Intent i = new Intent(XThingVpnPlugin.ACTION_STATUS);
        i.setPackage(getPackageName());
        i.putExtra("state", state);
        i.putExtra("bytesUp", bytesUp.get());
        i.putExtra("bytesDown", bytesDown.get());
        if (error != null) i.putExtra("error", error);
        sendBroadcast(i);
    }

    private void emitStats(long up, long down) {
        Intent i = new Intent(XThingVpnPlugin.ACTION_STATUS);
        i.setPackage(getPackageName());
        i.putExtra("state", "connected");
        i.putExtra("bytesUp", up);
        i.putExtra("bytesDown", down);
        sendBroadcast(i);
    }

    private Notification buildNotification(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (Build.VERSION.SDK_INT >= 26 && nm.getNotificationChannel(NOTIFY_CHANNEL) == null) {
            NotificationChannel ch = new NotificationChannel(
                NOTIFY_CHANNEL, "XThing VPN", NotificationManager.IMPORTANCE_LOW);
            ch.setShowBadge(false);
            nm.createNotificationChannel(ch);
        }
        Intent disconnect = new Intent(this, XThingVpnService.class).setAction(ACTION_DISCONNECT);
        PendingIntent pi = PendingIntent.getService(
            this, 0, disconnect,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new NotificationCompat.Builder(this, NOTIFY_CHANNEL)
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setContentTitle("XThing VPN")
            .setContentText(text)
            .setOngoing(true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Отключить", pi)
            .build();
    }

    private void updateNotification(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(NOTIFY_ID, buildNotification(text));
    }

    private void writeFile(File f, String content) throws Exception {
        java.io.FileOutputStream fos = new java.io.FileOutputStream(f);
        fos.write(content.getBytes("UTF-8"));
        fos.close();
    }
}
