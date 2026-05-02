package com.xthing.vpn;

import android.Manifest;
import android.app.Activity;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.net.VpnService;
import android.os.Build;
import androidx.activity.result.ActivityResult;
import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "XThingVpn",
    permissions = {
        @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications")
    }
)
public class XThingVpnPlugin extends Plugin {

    public static final String EVENT_STATUS = "status";
    public static final String ACTION_STATUS = "com.xthing.vpn.STATUS";

    private PluginCall pendingConnect;
    private final BroadcastReceiver statusReceiver = new BroadcastReceiver() {
        @Override public void onReceive(Context ctx, Intent intent) {
            JSObject ev = new JSObject();
            ev.put("state", intent.getStringExtra("state"));
            if (intent.hasExtra("bytesUp")) ev.put("bytesUp", intent.getLongExtra("bytesUp", 0));
            if (intent.hasExtra("bytesDown")) ev.put("bytesDown", intent.getLongExtra("bytesDown", 0));
            if (intent.hasExtra("error")) ev.put("error", intent.getStringExtra("error"));
            notifyListeners(EVENT_STATUS, ev);
        }
    };

    @Override
    public void load() {
        super.load();
        IntentFilter filter = new IntentFilter(ACTION_STATUS);
        getContext().registerReceiver(statusReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
    }

    @Override
    protected void handleOnDestroy() {
        try { getContext().unregisterReceiver(statusReceiver); } catch (Exception ignored) {}
        super.handleOnDestroy();
    }

    @PluginMethod
    public void prepare(PluginCall call) {
        Intent prepareIntent = VpnService.prepare(getContext());
        if (prepareIntent == null) {
            JSObject ret = new JSObject();
            ret.put("granted", true);
            call.resolve(ret);
            return;
        }
        startActivityForResult(call, prepareIntent, "onPrepareResult");
    }

    @ActivityCallback
    private void onPrepareResult(PluginCall call, ActivityResult result) {
        boolean granted = result.getResultCode() == Activity.RESULT_OK;
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        String protocol = call.getString("protocol");
        String address = call.getString("address");
        Integer port = call.getInt("port");
        String payload = call.getString("payload");
        if (protocol == null || address == null || port == null || payload == null) {
            call.reject("Missing protocol/address/port/payload");
            return;
        }

        // На Android 13+ POST_NOTIFICATIONS запрашивается runtime — без него
        // foreground-нотификация просто не отображается, и пользователь не
        // увидит, что VPN работает (плюс на новых версиях это может приводить
        // к остановке foreground-сервиса).
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
            && ContextCompat.checkSelfPermission(getContext(), Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            pendingConnect = call;
            call.setKeepAlive(true);
            requestPermissionForAlias("notifications", call, "onNotifPermResult");
            return;
        }

        proceedConnect(call, protocol, address, port, payload);
    }

    @PermissionCallback
    private void onNotifPermResult(PluginCall call) {
        // Игнорируем отказ — VPN всё равно поднимаем, просто без нотификации
        // (на Android 14+ это рискованно, но мы не хотим блокировать flow).
        proceedConnect(
            call,
            call.getString("protocol"),
            call.getString("address"),
            call.getInt("port"),
            call.getString("payload")
        );
    }

    private void proceedConnect(PluginCall call, String protocol, String address, Integer port, String payload) {
        // Получаем разрешение VpnService (если ещё нет)
        Intent prepareIntent = VpnService.prepare(getContext());
        if (prepareIntent != null) {
            pendingConnect = call;
            call.setKeepAlive(true);
            startActivityForResult(call, prepareIntent, "onConnectPrepareResult");
            return;
        }

        startTunnel(call, protocol, address, port, payload);
    }

    @ActivityCallback
    private void onConnectPrepareResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.reject("VPN-разрешение отклонено пользователем");
            return;
        }
        startTunnel(
            call,
            call.getString("protocol"),
            call.getString("address"),
            call.getInt("port"),
            call.getString("payload")
        );
    }

    private void startTunnel(PluginCall call, String protocol, String address, int port, String payload) {
        Intent svc = new Intent(getContext(), XThingVpnService.class);
        svc.setAction(XThingVpnService.ACTION_CONNECT);
        svc.putExtra("protocol", protocol);
        svc.putExtra("address", address);
        svc.putExtra("port", port);
        svc.putExtra("payload", payload);
        getContext().startForegroundService(svc);
        call.resolve();
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        Intent svc = new Intent(getContext(), XThingVpnService.class);
        svc.setAction(XThingVpnService.ACTION_DISCONNECT);
        getContext().startService(svc);
        call.resolve();
    }
}
