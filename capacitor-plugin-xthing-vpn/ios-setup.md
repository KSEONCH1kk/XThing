# XThing VPN — iOS setup

iOS-VPN построен на NetworkExtension framework. Архитектура:

```
host-app (Capacitor)
  └─ XThingVpnPlugin.swift   ← в этом плагине
       │ NETunnelProviderManager (загружает/сохраняет VPN-конфиг)
       │
       ▼ запускает по requesta'у
PacketTunnelProvider extension target  ← создаётся в Xcode проекта-потребителя
  └─ PacketTunnelProvider.swift        ← шаблон лежит в плагине,
                                          но компилируется в extension target
```

Capacitor сам копирует только `ios/Plugin/`. Файлы из
`ios/PacketTunnelProvider/` Capacitor НЕ ставит — extension должен жить в
проекте-потребителе (App.xcodeproj), потому что у него своя bundle identity,
свои entitlements и свой provisioning profile.

## Шаги (один раз)

### 1. Apple Developer Account

Network Extensions — *paid* capability. Без активного Apple Developer Program
(99$/год) подписать app + extension с PTP не получится.

### 2. Создать App Group

Нужен общий App Group для host-app и extension, чтобы передавать кешированный
конфиг (для Shortcuts/Siri-старта) и общие prefs.

В Apple Developer портале:
- Identifiers → + → App Groups → создать `group.com.xthing.vpn`.
- Прикрепить группу к двум App ID:
  - `com.xthing.vpn` — host-app
  - `com.xthing.vpn.ptp` — extension (создать тоже)

Bundle ID PTP должен совпадать с `XThingVpnPlugin.providerBundleId` в Swift —
по умолчанию `com.xthing.vpn.ptp`.

### 3. Network Extensions capability

Тем же App ID (host + ptp) включить **Network Extensions** capability,
тип Packet Tunnel.

### 4. Сгенерировать provisioning profiles

Заново скачать Development и Distribution provisioning profiles для обоих App ID.
В каждом должен быть Network Extensions entitlement.

### 5. В Xcode (open `ios/App/App.xcworkspace`)

#### a) Добавить новый target

`File → New → Target → Network Extension → Packet Tunnel Provider`.

- Product Name: `XThingPTP`
- Bundle Identifier: `com.xthing.vpn.ptp`
- Activate scheme: Yes.

В созданный target добавить файл из плагина:

```
node_modules/capacitor-plugin-xthing-vpn/ios/PacketTunnelProvider/PacketTunnelProvider.swift
```

(Drag & drop в новый target, при этом убрать галку «Copy items if needed» —
файл должен ссылаться, чтобы апдейты плагина подхватывались сами.)

#### b) Capabilities обоим target'ам

Для App target и для XThingPTP target в `Signing & Capabilities`:

- + Network Extensions → отметить **Packet Tunnel Provider**
- + App Groups → выбрать `group.com.xthing.vpn`

#### c) Embed extension в App

Target App → Build Phases → + → New Embed Foundation Extensions.
Перетащить туда XThingPTP.appex.

### 6. Info.plist host-app

В `ios/App/App/Info.plist` добавить (для нормальной отмены прав через UI):

```xml
<key>NSAppTransportSecurity</key>
<dict>
    <key>NSAllowsArbitraryLoads</key>
    <false/>
</dict>
```

### 7. Сборка

```bash
npm run build:client            # client/dist
npx cap sync ios
npx cap open ios                # откроется Xcode
# Cmd+R — запуск на устройстве (симулятор VPN не поддерживает)
```

## Интеграция нативных ядер

В `PacketTunnelProvider.swift` есть TODO-метки. Нужно интегрировать как
`.xcframework` следующие компоненты:

| Что              | Откуда взять                                   | Команда сборки (на macOS)                     |
|------------------|------------------------------------------------|-----------------------------------------------|
| xray-core        | https://github.com/XTLS/Xray-core              | `gomobile bind -target=ios ./main`            |
| hysteria         | https://github.com/apernet/hysteria            | `gomobile bind -target=ios ./app`             |
| hev-socks5-tunnel| https://github.com/heiher/hev-socks5-tunnel    | Xcode toolchain CMake build → universal lib   |

Готовый `.xcframework` положить в `ios/App/App/Frameworks/` и подключить
к target'у XThingPTP (Build Phases → Link Binary With Libraries).

После этого заполнить `startCore()` / `stopCore()` / `startTun2Socks()`
в `PacketTunnelProvider.swift` (там уже есть комментарии, что вызывать).

## Симулятор

VPN на iOS-симуляторе **не работает** — NetworkExtension доступна только на
реальных устройствах. Для разработки нужен iPhone/iPad, подключённый к Mac.

## Тестирование без своего ядра

Чтобы убедиться, что сам extension target и pipeline работают, можно сначала
оставить TODO-методы пустыми и проверить, что:

1. Тап «Подключить» в приложении показывает системный диалог
   «"XThing" хочет добавить VPN-конфигурации».
2. После согласия в `Settings → VPN` появляется «XThing VPN» со статусом
   "Connected" (даже без работающего ядра — прокси-туннель пустой).
3. JS получает event `status` → `connected`.

Если это работает — каркас собран правильно, осталось докрутить ядра.
