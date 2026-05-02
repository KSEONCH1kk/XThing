package com.xthing.vpn;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.net.VpnService;
import android.os.Build;
import android.os.ParcelFileDescriptor;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;

import org.json.JSONObject;

import java.io.File;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Системный VPN-сервис XThing.
 *
 * Архитектура:
 *   1. Устанавливаем TUN через VpnService.Builder.
 *   2. Стартуем core:
 *        - VLESS  → XrayJniRunner (in-process через AndroidLibXrayLite AAR)
 *        - Hysteria2 → CoreRunner (exec бинарника libhysteria.so)
 *      Оба слушают SOCKS5 на 127.0.0.1:10808.
 *   3. Стартуем HevTunRunner (libhevtun.so) — направляет TUN → SOCKS5.
 *   4. StatsPoller считывает байты:
 *        - VLESS  → xrayJni.queryStats("proxy", direction)
 *        - Hysteria2 → HTTP API на 127.0.0.1:10090/traffic
 */
public class XThingVpnService extends VpnService {

    public static final String ACTION_CONNECT = "com.xthing.vpn.CONNECT";
    public static final String ACTION_DISCONNECT = "com.xthing.vpn.DISCONNECT";

    /**
     * Глобальный признак активного VPN-сеанса. Сервис и TileService живут в
     * одном процессе, поэтому static-поле — самый дешёвый канал передачи
     * состояния (broadcast приходит только пока тайл «слушает», а нам нужно
     * корректное состояние на момент onStartListening).
     */
    public static volatile boolean IS_RUNNING = false;

    private static final String TAG = "XThingVpn";
    private static final String NOTIFY_CHANNEL = "xthing-vpn";
    private static final int NOTIFY_ID = 4242;

    private static final String VPN_ADDR = "10.0.0.2";
    private static final String VPN_DNS = "1.1.1.1";
    private static final int VPN_MTU = 1500;

    private ParcelFileDescriptor tunPfd;
    private int detachedTunFd = -1;        // fd, переданный во владение native
    private XrayJniRunner xrayRunner;     // используется только для VLESS
    private CoreRunner coreRunner;         // используется только для Hysteria2
    private HevTunRunner tunRunner;
    private StatsPoller statsPoller;
    private String currentProtocol;
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
            tearDown("disconnecting", null);
        }

        startForegroundCompat(buildNotification("Подключение…"));
        emitStatus("connecting", null);

        String protocol = intent.getStringExtra("protocol");
        String address = intent.getStringExtra("address");
        int port = intent.getIntExtra("port", 0);
        String payload = intent.getStringExtra("payload");
        currentProtocol = protocol;

        try {
            establishTun();
            startCoreAndTunBridge(protocol, address, port, payload);
            running.set(true);
            IS_RUNNING = true;
            updateNotification("Подключено");
            emitStatus("connected", null);
            startStats();
            // Кешируем удачный конфиг для Quick Settings tile — он подключается
            // без UI, поэтому ему нужен готовый payload.
            getSharedPreferences(XThingVpnTileService.PREFS, MODE_PRIVATE).edit()
                .putString(XThingVpnTileService.KEY_PROTOCOL, protocol)
                .putString(XThingVpnTileService.KEY_ADDRESS, address)
                .putInt(XThingVpnTileService.KEY_PORT, port)
                .putString(XThingVpnTileService.KEY_PAYLOAD, payload)
                .apply();
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

        // Свой пакет исключаем — иначе трафик плагина зацикливается
        try {
            b.addDisallowedApplication(getPackageName());
        } catch (Exception ignored) {}

        tunPfd = b.establish();
        if (tunPfd == null) {
            throw new IllegalStateException("VpnService.Builder.establish() вернул null");
        }
    }

    private void startCoreAndTunBridge(String protocol, String address, int port, String payload) throws Exception {
        JSONObject params = new JSONObject(payload);

        if ("vless".equals(protocol)) {
            // 1a) VLESS → AndroidLibXrayLite (JNI, in-process)
            String coreCfg = ConfigBuilders.buildXrayConfig(address, port, params);
            xrayRunner = new XrayJniRunner(this);
            xrayRunner.start(coreCfg);
        } else {
            // 1b) Hysteria2 → standalone бинарник через exec
            File cfgDir = new File(getFilesDir(), "vpn");
            if (!cfgDir.exists()) cfgDir.mkdirs();
            File cfgFile = new File(cfgDir, "hysteria.json");
            String coreCfg = ConfigBuilders.buildHysteriaConfig(address, port, params);
            writeFile(cfgFile, coreCfg);

            coreRunner = new CoreRunner(this, "libhysteria.so", protocol, cfgFile.getAbsolutePath());
            coreRunner.start();
        }

        // Дать core поднять SOCKS-listener
        Thread.sleep(500);

        // 2) hev-socks5-tunnel: TUN <-> 127.0.0.1:10808
        // detachFd снимает владение с PFD и передаёт его native-стороне.
        // Закрывать fd теперь будет hev_socks5_tunnel_quit() / native cleanup.
        // Без detach Java GC мог закрыть fd под носом у nativeMain → SIGSEGV.
        detachedTunFd = tunPfd.detachFd();
        tunPfd = null;
        tunRunner = new HevTunRunner(this, detachedTunFd, VPN_MTU);
        tunRunner.start();
    }

    private void startStats() {
        statsPoller = new StatsPoller(this, currentProtocol, xrayRunner, () -> running.get(), (up, down) -> {
            bytesUp.set(up);
            bytesDown.set(down);
            emitStats(up, down);
        });
        statsPoller.start();
    }

    private void tearDown(String finalState, String error) {
        running.set(false);
        IS_RUNNING = false;
        if (statsPoller != null) statsPoller.stopPolling();
        // Порядок важен: сначала nativeQuit + join hev-потока, и ТОЛЬКО потом
        // закрытие TUN-fd. Иначе hev читает с уже закрытого fd → EBADF / SIGSEGV.
        if (tunRunner != null) tunRunner.stop();
        if (xrayRunner != null) xrayRunner.stop();
        if (coreRunner != null) coreRunner.stop();
        xrayRunner = null;
        coreRunner = null;
        tunRunner = null;
        if (tunPfd != null) {
            try { tunPfd.close(); } catch (Exception ignored) {}
            tunPfd = null;
        }
        // hev_socks5_tunnel_quit() выходит из main_loop, но TUN-fd, который
        // мы передали снаружи через detachFd, hev своим не считает и не
        // закрывает. Без явного close() VpnService-сессия живёт дальше:
        // Android продолжает заворачивать весь трафик в TUN, а на выходе
        // никто не слушает — отсюда «отключился, но интернета нет».
        // adoptFd() оборачивает int в PFD только чтобы сразу же его close().
        if (detachedTunFd != -1) {
            try {
                ParcelFileDescriptor.adoptFd(detachedTunFd).close();
            } catch (Exception e) {
                Log.w(TAG, "close detached tun fd failed", e);
            }
            detachedTunFd = -1;
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
            // setOngoing(true) — нельзя смахнуть, нельзя «Очистить всё».
            // setSilent — без звука/вибрации при апдейтах текста.
            // FOREGROUND_SERVICE_IMMEDIATE — на Android 12+ нотификация
            // показывается сразу, без 10-секундной задержки (иначе выглядит
            // так, будто VPN «тормозит на старте»).
            // CATEGORY_SERVICE — корректная категоризация фонового сервиса.
            .setOngoing(true)
            .setSilent(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Отключить", pi)
            .build();
    }

    private void updateNotification(String text) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        nm.notify(NOTIFY_ID, buildNotification(text));
    }

    /**
     * На Android 14+ startForeground обязан получить foregroundServiceType,
     * совпадающий с тем, что объявлен в манифесте (specialUse), иначе
     * MissingForegroundServiceTypeException и нотификация не появляется.
     * Своего TYPE_VPN в Android нет — VpnService живёт под SPECIAL_USE.
     */
    private void startForegroundCompat(Notification n) {
        int type = 0;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            type = ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceCompat.startForeground(this, NOTIFY_ID, n, type);
        } else {
            startForeground(NOTIFY_ID, n);
        }
    }

    private void writeFile(File f, String content) throws Exception {
        java.io.FileOutputStream fos = new java.io.FileOutputStream(f);
        fos.write(content.getBytes("UTF-8"));
        fos.close();
    }
}
