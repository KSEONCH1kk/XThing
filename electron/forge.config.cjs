const path = require("path");
const fs = require("fs");

const ICON_ICO = path.resolve(__dirname, "build/icon.ico");
const hasIcon = fs.existsSync(ICON_ICO);

/**
 * Electron Forge config.
 *
 * Сборка: `npm run make` в electron/ (или `npm run dist:forge` из корня).
 *
 * Что делает make:
 *   1. tsc + copy-proto (через npm-скрипт build, см. package.json).
 *   2. electron-forge package — упаковывает app в release/<platform>-<arch>/.
 *   3. electron-forge make — делает Squirrel-инсталлятор (.exe + nupkg + RELEASES)
 *      в release/make/squirrel.windows/<arch>/.
 *
 * Squirrel-артефакты:
 *   - XThing-Setup.exe — то, что отдаём пользователю.
 *   - xthing-vpn-{version}-full.nupkg + RELEASES — для авто-апдейтов
 *     (если позже подключите squirrel-update сервер).
 */
module.exports = {
  packagerConfig: {
    name: "XThing",
    executableName: "XThing",
    appBundleId: "com.xthing.vpn",
    appCopyright: "© XThing",
    asar: true,
    // Только то, что реально нужно в final-app: скомпилированный TS, package.json,
    // и зависимости. Остальное (исходники, конфиги, dev-скрипты) — отбрасываем.
    ignore: [
      /^\/release($|\/)/,
      /^\/scripts($|\/)/,
      /^\/src($|\/)/,
      /^\/build($|\/)/,
      /^\/electron-builder\.yml$/,
      /^\/forge\.config\.cjs$/,
      /^\/tsconfig\.json$/,
      /^\/\.env\..*$/,
      /^\/bin($|\/)/,           // в extraResource — не дублируем в asar
    ],
    // Файлы рядом с приложением (НЕ внутри asar). На Windows ляжет в
    // <install-dir>/resources/bin/ — там xray.exe, hysteria.exe, wintun.dll
    // и т.д. Код смотрит туда через process.resourcesPath/bin/.
    //
    // .env.prod (с SERVER_CONFIG_AES_KEY) копируется отдельно в hook ниже,
    // потому что его нужно ПЕРЕИМЕНОВАТЬ в .env (extraResource не умеет
    // переименовывать), а main.ts ищет именно resources/.env.
    //
    // Фронт (client/dist) сюда НЕ добавляем: приложение грузится через
    // win.loadURL(XTHING_CLIENT_URL) с задеплоенного домена.
    extraResource: [
      "bin",
    ],
    win32metadata: {
      CompanyName: "XThing",
      ProductName: "XThing VPN",
      FileDescription: "XThing VPN client",
    },
    ...(hasIcon ? { icon: path.resolve(__dirname, "build/icon") } : {}),
  },

  rebuildConfig: {},

  makers: [
    {
      // Squirrel.Windows. Делает один .exe-инсталлятор + дельта-апдейтные nupkg.
      name: "@electron-forge/maker-squirrel",
      config: {
        // ASCII-имя без пробелов и @ — из него строится service-name и пути
        // в %LOCALAPPDATA%\<name>\.
        name: "XThingVPN",
        // Имя готового файла-инсталлятора.
        setupExe: "XThing-Setup.exe",
        // Иконка приложения (ярлык, "Программы и компоненты", сама .exe).
        ...(hasIcon ? { setupIcon: ICON_ICO, iconUrl: "file:///" + ICON_ICO.replace(/\\/g, "/") } : {}),
        // loadingGif: путь к gif для splash-экрана при апдейте — опционально.
      },
    },
    // ZIP — удобен для ручного скачивания / для CI-update без Squirrel.
    {
      name: "@electron-forge/maker-zip",
      platforms: ["win32"],
    },
  ],

  plugins: [
    // Если в зависимостях появятся нативные .node — раскомментируйте, чтобы
    // они нормально извлеклись из asar при первом запуске.
    // { name: "@electron-forge/plugin-auto-unpack-natives", config: {} },
  ],

  hooks: {
    // Forge сам не компилирует TS. Гарантируем, что dist/main.js свежий до
    // упаковки. (Хук вызывается перед package и make.)
    generateAssets: async () => {
      const { execSync } = require("node:child_process");
      execSync("npm run build", { cwd: __dirname, stdio: "inherit" });
    },

    // .env.prod лежит в electron/, копируем его в финальный resources/.env.
    // buildPath — путь к app/ внутри упакованной структуры; resources/ —
    // его родитель, рядом с app.asar.
    packageAfterCopy: async (_forgeConfig, buildPath /*, electronVersion, platform, arch */) => {
      const src = path.resolve(__dirname, ".env.prod");
      if (!fs.existsSync(src)) {
        console.warn("[forge] .env.prod не найден — SERVER_CONFIG_AES_KEY не попадёт в сборку.");
        return;
      }
      const resourcesDir = path.dirname(buildPath);
      const dst = path.join(resourcesDir, ".env");
      fs.copyFileSync(src, dst);
      console.log("[forge] copied .env.prod →", dst);
    },
  },
};
