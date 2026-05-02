package com.xthing.vpn;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.os.Build;
import android.service.quicksettings.Tile;
import android.service.quicksettings.TileService;
import android.util.Log;

import androidx.annotation.RequiresApi;

/**
 * Плитка XThing в шторке быстрых настроек Android («Изменить» → перетащить).
 *
 *   Tile inactive (OFF) → tap:
 *     - если в prefs есть последний успешный конфиг → стартуем сервис
 *       напрямую (без UI), пользуясь уже выданным VPN-разрешением.
 *     - если конфига нет (свежая установка) → открываем MainActivity, чтобы
 *       пользователь авторизовался и выбрал сервер.
 *
 *   Tile active (ON) → tap:
 *     - сразу шлём ACTION_DISCONNECT, никакой UI не нужен.
 *
 * Слушает broadcast XThingVpnPlugin.ACTION_STATUS, чтобы тайл отражал
 * актуальное состояние пока он виден (между onStartListening / onStopListening).
 */
@RequiresApi(api = Build.VERSION_CODES.N)
public class XThingVpnTileService extends TileService {

    private static final String TAG = "XThingTile";
    static final String PREFS = "xthing.last_config";
    static final String KEY_PROTOCOL = "protocol";
    static final String KEY_ADDRESS = "address";
    static final String KEY_PORT = "port";
    static final String KEY_PAYLOAD = "payload";

    private final BroadcastReceiver statusReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context ctx, Intent intent) {
            applyState(intent.getStringExtra("state"));
        }
    };

    @Override
    public void onStartListening() {
        super.onStartListening();
        IntentFilter filter = new IntentFilter(XThingVpnPlugin.ACTION_STATUS);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            registerReceiver(statusReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(statusReceiver, filter);
        }
        // Сразу выставляем состояние из флага сервиса. Сервис и тайл живут в
        // одном процессе, так что чтение static volatile — корректное.
        // Без этого после переоткрытия шторки тайл всегда показывал OFF, даже
        // если VPN активен (broadcast ACTION_STATUS приходит реже, чем
        // открываются шторки).
        applyState(XThingVpnService.IS_RUNNING ? "connected" : null);
    }

    @Override
    public void onStopListening() {
        try { unregisterReceiver(statusReceiver); } catch (Exception ignored) {}
        super.onStopListening();
    }

    @Override
    public void onClick() {
        super.onClick();
        Tile t = getQsTile();
        if (t == null) return;

        if (t.getState() == Tile.STATE_ACTIVE) {
            // Disconnect — без UI.
            Intent svc = new Intent(this, XThingVpnService.class);
            svc.setAction(XThingVpnService.ACTION_DISCONNECT);
            startService(svc);
            t.setState(Tile.STATE_INACTIVE);
            t.updateTile();
            return;
        }

        SharedPreferences prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        String protocol = prefs.getString(KEY_PROTOCOL, null);
        String address = prefs.getString(KEY_ADDRESS, null);
        int port = prefs.getInt(KEY_PORT, 0);
        String payload = prefs.getString(KEY_PAYLOAD, null);

        if (protocol == null || address == null || port == 0 || payload == null) {
            // Нет кеша → открываем приложение, пусть юзер залогинится / выберет сервер.
            Intent open = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (open != null) {
                open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                    startActivityAndCollapse(android.app.PendingIntent.getActivity(
                        this, 0, open,
                        android.app.PendingIntent.FLAG_IMMUTABLE | android.app.PendingIntent.FLAG_UPDATE_CURRENT));
                } else {
                    //noinspection deprecation
                    startActivityAndCollapse(open);
                }
            }
            return;
        }

        // Поднимаем сервис тем же intent'ом, что и плагин при ACTION_CONNECT.
        // VpnService.prepare() вернёт null (разрешение уже было выдано раньше),
        // и сервис стартанёт без UI.
        Intent svc = new Intent(this, XThingVpnService.class);
        svc.setAction(XThingVpnService.ACTION_CONNECT);
        svc.putExtra("protocol", protocol);
        svc.putExtra("address", address);
        svc.putExtra("port", port);
        svc.putExtra("payload", payload);
        try {
            startForegroundService(svc);
            t.setState(Tile.STATE_ACTIVE);
            t.updateTile();
        } catch (Exception e) {
            Log.w(TAG, "tile start service failed", e);
        }
    }

    private void applyState(String state) {
        Tile t = getQsTile();
        if (t == null) return;
        if ("connected".equals(state)) {
            t.setState(Tile.STATE_ACTIVE);
        } else if ("connecting".equals(state)) {
            t.setState(Tile.STATE_UNAVAILABLE);
        } else {
            t.setState(Tile.STATE_INACTIVE);
        }
        t.updateTile();
    }
}
