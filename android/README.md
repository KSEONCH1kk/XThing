# Android (Capacitor)

Сам нативный проект (`android/app/...`) генерируется командой:

```bash
npm run build:client
npx cap add android
npm run android:sync
npm run android:open   # откроет Android Studio
```

После этого:
- `applicationId` уже задан в `capacitor.config.ts` → `com.xthing.vpn`
- `minSdk` поправить в `android/variables.gradle` на 26.

## VPN-плагин

Системный VPN на Android требует `android.net.VpnService`. Структура:

```
android/app/src/main/java/com/xthing/vpn/
├── XThingVpnPlugin.java           # @CapacitorPlugin(name = "XThingVpn")
└── XThingVpnService.java          # extends VpnService
```

Минимальный публичный API плагина (вызывается из JS):

```ts
// в client/src/lib/vpn-android.ts
import { registerPlugin } from "@capacitor/core";

interface XThingVpn {
  connect(opts: { protocol: "vless" | "hysteria2"; address: string; port: number; payload: string }): Promise<void>;
  disconnect(): Promise<void>;
  addListener(event: "status", cb: (data: { state: string; bytesUp?: number; bytesDown?: number }) => void): Promise<void>;
}

export const XThingVpn = registerPlugin<XThingVpn>("XThingVpn");
```

Реализация плагина под капотом запускает `VpnService`, поднимает TUN-интерфейс
и пускает трафик через xray/hysteria — варианты:

- **xray-core**: собрать `libxray.aar` (gomobile bind на go-mod) и линковать.
- **hysteria2**: `gomobile bind` от `apernet/hysteria/v2`.
- Альтернатива: использовать `tun2socks` (`badvpn-tun2socks` или
  `xjasonlyu/tun2socks`) и направить трафик в локальный SOCKS,
  поднятый xray.

Permissions в `AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_SPECIAL_USE" />
```

В `<application>`:
```xml
<service
    android:name=".XThingVpnService"
    android:permission="android.permission.BIND_VPN_SERVICE"
    android:foregroundServiceType="specialUse">
    <intent-filter>
        <action android:name="android.net.VpnService" />
    </intent-filter>
</service>
```

## Сборка

```bash
# Debug APK
cd android
./gradlew assembleDebug

# Release AAB (после настройки keystore в build.gradle)
./gradlew bundleRelease
```
