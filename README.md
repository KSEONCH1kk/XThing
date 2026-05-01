# XThing VPN

Кроссплатформенный VPN-клиент: Windows (Electron) + Android (Capacitor) + Backend (Node.js Fastify).
Поддержка протоколов **VLESS** (xray-core) и **Hysteria2**, ключевая система регистрации, лимит трафика.
Дизайн — строгий чёрно-белый.

## Структура

```
XThing/
├── client/                          # React + TS + Vite + Tailwind + Framer Motion (общий UI)
├── electron/                        # Electron main + preload + VPN manager (xray/hysteria)
├── server/                          # Fastify backend: auth, keys, servers, traffic, WS
├── capacitor-plugin-xthing-vpn/     # Нативный Android plugin: VpnService + TUN + tun2socks
├── android/                         # Генерируется командой `npx cap add android`
└── docker-compose.yml               # Postgres + Redis (опционально)
```

---

## ⚡ Quickstart на Windows (без Docker)

```powershell
# 1. Зависимости
npm install

# 2. Конфиг (можно ничего не менять — SQLite + memory Redis по умолчанию)
copy .env.example .env

# 3. Засеять демо-данные (3 сервера + 4 ключа всех тарифов)
npm run seed
# В консоли увидите: Demo trial key: XTHING-XXXX-XXXX-XXXX и т.д. — сохраните

# 4. Запустить backend + frontend
npm run dev
# server  → http://localhost:4000
# client  → http://localhost:5173

# 5. (опционально) Запустить Electron-окно
npm run dev:electron
```

В этом режиме:
- БД — SQLite-файл `server/data.db` (никаких внешних сервисов)
- Redis — in-process mock (`ioredis-mock`)
- Никаких контейнеров, всё работает как обычное Node-приложение

---

## Quickstart с Docker (Mac/Linux/Windows+Docker Desktop)

```bash
npm install
cp .env.example .env

# В .env заменить:
#   DATABASE_URL=postgres://xthing:xthing@localhost:5432/xthing
#   REDIS_URL=redis://localhost:6379

npm run db:up        # docker compose up -d (Postgres + Redis)
npm run seed
npm run dev
```

---

## Сборка

```bash
# Windows (.exe + portable + NSIS)
npm run dist:win

# Android (требуется Android SDK)
npm run android:sync
npm run android:open   # дальше — Build APK / AAB через Android Studio
```

## VPN бинарники

### Desktop
В `electron/bin/` положить:
- `xray.exe` — https://github.com/XTLS/Xray-core/releases
- `hysteria.exe` — https://github.com/apernet/hysteria/releases

### Android
В `android/app/src/main/jniLibs/<abi>/` положить (под именами `lib*.so`):
- `libxray.so` (xray-core)
- `libhysteria.so` (hysteria2)
- `libtun2socks.so` (xjasonlyu/tun2socks)

Подробнее: `capacitor-plugin-xthing-vpn/README.md`.

## Ключи активации

Формат `XTHING-XXXX-XXXX-XXXX`. Генерируется через `npm run seed` или
вызовом `generateKey()` из `server/src/keys/service.ts`.
Один ключ = один аккаунт; повторно использовать нельзя.

## Архитектура

```
[Client React]                    [Electron main]
  ├ XField/XButton/...            ├ VpnManager
  ├ Splash/Login/Main/Servers     │   ├─ spawn xray.exe / hysteria.exe
  ├ Profile + history             │   └─ stats: gRPC (xray) / HTTP (hysteria2)
  └ store: auth/vpn/toast         └ IPC ← preload → window.xthing
        │                                              ▲
        │                                              │
        ▼                                              │
   [Capacitor]──────────► XThingVpn plugin ────────────┘
                          (Android VpnService + TUN + tun2socks)
        │
        ▼
[Server Fastify]
  ├ /auth/{register,login,logout,refresh}     (JWT access + httpOnly refresh)
  ├ /user/{me,subscription,traffic,history}
  ├ /servers, /servers/:id/config             (AES-256-GCM payload)
  ├ /keys/{activate,info}
  ├ /traffic/report
  └ /ws/traffic                                (broadcast on traffic update)
        │
        ├ DB:    SQLite (dev) / Postgres (prod)
        └ Redis: in-memory mock (dev) / ioredis (prod)
```
