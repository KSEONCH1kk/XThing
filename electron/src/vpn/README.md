# XThing VPN core

## Desktop (Windows/macOS/Linux)

Запуск VPN — через child_process: xray-core / hysteria2 спавнятся как
дочерние процессы, конфиг кладётся во временный файл (`os.tmpdir()`),
после disconnect файл удаляется. На Windows процесс убивается через
`taskkill /pid /t /f`, чтобы не оставить детей в дереве.

Бинарники должны лежать в `electron/bin/`:
- `xray.exe` (Windows) / `xray` (Linux/macOS)
- `hysteria.exe` / `hysteria`

В упакованном приложении они кладутся в `process.resourcesPath/bin`.

### Системный proxy / TUN

В стандартной поставке xray и hysteria выставляются на 127.0.0.1
(SOCKS:10808, HTTP:10809). Чтобы маршрутизировать **весь** трафик:
- Windows: настроить системный proxy через `WinHTTP set proxy`
  или поднять TUN через `tun2socks` (отдельный бинарник).
- Опционально: TUN-режим встроен в Hysteria2 v2 (см. флаг `tun:` в конфиге).

## Android

На Android ребёнка-процесса с системным VPN-туннелем поднять нельзя —
нужен `VpnService`. Реализация:
1. Создать Capacitor-плагин `xthing-vpn` (Java/Kotlin).
2. В нём расширить `VpnService`, поднять `tun2socks` или собственный pipe
   к встроенной библиотеке xray (libxray.aar) / hysteria (через JNI).
3. Из JS вызывать `XThingVpn.connect({...})`.

См. шаблон в `client/src/lib/platform.ts` — клиент уже умеет переключаться
между Electron-bridge и Capacitor-bridge.

## Kill-switch

Перед disconnect никаких блокировок — но при **неожиданном** обрыве
менеджер emits `error`, и UI оставляет кнопку в состоянии error. Если
включить kill-switch (пункт меню в настройках, не входит в MVP), нужно
поднять deny-all firewall rule перед connect и снять её после disconnect.

## Авто-реконнект

В `manager.ts` при `proc.exit` с ненулевым кодом эмитим `error`. UI может
повторно вызвать `connect()`. Внутренний реконнект (3 попытки) включается
флагом — добавить в настройках по необходимости.
