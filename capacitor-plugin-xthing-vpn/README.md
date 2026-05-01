# capacitor-plugin-xthing-vpn

Нативный VPN-плагин для Capacitor (Android). Поднимает системный туннель через
`VpnService` + TUN, направляет трафик через xray-core (VLESS) или
Hysteria2 (через `tun2socks` → локальный SOCKS5).

## Установка в основное приложение

```bash
# из корня монорепо
cd capacitor-plugin-xthing-vpn
npm install
npm run build

cd ../client
npm install ../capacitor-plugin-xthing-vpn

# затем
cd ..
npm run android:sync   # подтянет плагин в android/
```

## Бинарники в `jniLibs`

Android разрешает запускать exec() **только** из `nativeLibraryDir`, а это —
`jniLibs/<abi>/lib*.so`. Поэтому core-бинарники нужно положить туда под
"библиотечными" именами:

```
android/app/src/main/jniLibs/
├── arm64-v8a/
│   ├── libxray.so          # переименованный xray-core под arm64
│   ├── libhysteria.so      # hysteria v2 под arm64
│   └── libtun2socks.so     # xjasonlyu/tun2socks под arm64
├── armeabi-v7a/
│   └── ... (те же 3 бинарника)
└── x86_64/
    └── ... (те же 3 бинарника)
```

Источники:
- xray-core: https://github.com/XTLS/Xray-core/releases (или собрать через `gomobile`)
- hysteria2: https://github.com/apernet/hysteria/releases
- tun2socks: https://github.com/xjasonlyu/tun2socks/releases

В `app/build.gradle` отключите stripping, чтобы они не были обработаны
как обычные .so:
```gradle
android {
    packagingOptions {
        jniLibs {
            useLegacyPackaging = true
        }
        doNotStrip "**/libxray.so"
        doNotStrip "**/libhysteria.so"
        doNotStrip "**/libtun2socks.so"
    }
}
```

## Использование из JS

```ts
import { XThingVpn } from "capacitor-plugin-xthing-vpn";

await XThingVpn.prepare();   // покажет системный диалог разрешения

await XThingVpn.connect({
  protocol: "vless",
  address: "de1.example.com",
  port: 443,
  payload: JSON.stringify({
    id: "...uuid...",
    flow: "xtls-rprx-vision",
    network: "tcp",
    security: "reality",
    sni: "www.cloudflare.com",
    pbk: "...",
    sid: "..."
  })
});

const sub = await XThingVpn.addListener("status", (s) => {
  console.log(s.state, s.bytesUp, s.bytesDown);
});

await XThingVpn.disconnect();
sub.remove();
```

## Архитектура

```
JS (XThingVpn.connect)
        │
        ▼
XThingVpnPlugin.java  ──── VpnService.prepare()  (Activity dialog)
        │
        ▼  (startForegroundService)
XThingVpnService (extends VpnService)
   │
   ├── establish TUN (10.0.0.2/24, route 0.0.0.0/0, DNS 1.1.1.1)
   │
   ├── CoreRunner       → spawns libxray.so / libhysteria.so → 127.0.0.1:10808 SOCKS
   │
   ├── Tun2SocksRunner  → spawns libtun2socks.so → пайпит TUN ↔ 127.0.0.1:10808
   │
   └── StatsPoller      → опрашивает stats:
                            xray: `libxray.so api statsquery ...`
                            hysteria2: GET http://127.0.0.1:10090/traffic
                          → broadcast com.xthing.vpn.STATUS
                          → плагин ловит и отдаёт через notifyListeners("status", ...)
```

## Permissions

Уже включены в `AndroidManifest.xml` плагина:
- `INTERNET`, `ACCESS_NETWORK_STATE`
- `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_SPECIAL_USE`
- `POST_NOTIFICATIONS` (Android 13+)

## Известные ограничения

- **arch x86 (32-bit)** не поддерживается — современные устройства редко
  используют x86, а Capacitor по умолчанию его и не собирает.
- IPv6 пока не маршрутизируем (`addRoute("0.0.0.0", 0)` only). Чтобы добавить
  IPv6 — расширить `XThingVpnService.establishTun()` через `addAddress("fd00::2", 7)`
  + `addRoute("::", 0)`.
- Kill-switch (блокировать трафик при разрыве) не включён — для этого нужно
  оставить TUN активным после смерти core, что реализуется через дополнительный
  watchdog-таймер. См. TODO в `XThingVpnService.onRevoke`.
