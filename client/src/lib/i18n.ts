import { create } from "zustand";

export type Lang = "ru" | "en";

const STORAGE_KEY = "xthing.lang";

function detectLang(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "ru" || saved === "en") return saved;
  } catch {}
  if (typeof navigator !== "undefined") {
    const code = navigator.language.toLowerCase();
    if (code.startsWith("ru")) return "ru";
  }
  return "en";
}

const ru: Record<string, string> = {
  // common
  "common.cancel": "Отмена",
  "common.save": "Сохранить",
  "common.create": "Создать",
  "common.delete": "Удалить",
  "common.add": "Добавить",
  "common.refresh": "Обновить",
  "common.close": "Закрыть",
  "common.error": "Ошибка",
  "common.success": "Успех",
  "common.loading": "Загрузка…",
  "common.empty": "Пусто",
  "common.back": "Назад",
  "common.confirm": "Подтвердить",
  "common.yes": "Да",
  "common.no": "Нет",
  "common.unlimited": "Безлимит",
  "common.copy": "Скопировать",
  "common.copyAll": "Скопировать всё",
  "common.activate": "Активировать",
  "common.edit": "Редактировать",
  "common.up": "Вверх",
  "common.down": "Вниз",

  // tabs
  "tab.main": "Главная",
  "tab.servers": "Серверы",
  "tab.profile": "Профиль",
  "tab.admin": "Админ",

  // splash
  "splash.subtitle": "Защищённое соединение",

  // login
  "login.title": "Вход в XThing",
  "register.title": "Регистрация",
  "login.subtitle": "Введите email и пароль",
  "register.subtitle": "Введите данные и ключ активации",
  "login.email": "Email",
  "login.password": "Пароль",
  "login.key": "Ключ активации",
  "login.submitLogin": "Войти",
  "login.submitRegister": "Зарегистрироваться",
  "login.toRegister": "Нет аккаунта? Зарегистрироваться",
  "login.toLogin": "Уже есть аккаунт? Войти",
  "login.errEmail": "Неверный email",
  "login.errPwd": "Минимум 8 символов",
  "login.errKey": "Формат: XTHING-XXXX-XXXX-XXXX",
  "login.welcome": "Добро пожаловать",
  "login.created": "Аккаунт создан",

  // main
  "main.account": "Аккаунт",
  "main.downloaded": "Скачано",
  "main.uploaded": "Загружено",
  "main.lowTraffic": "Осталось менее 10% трафика. Активируйте новый ключ заранее.",
  "main.noServers": "Нет серверов",
  "main.notLoaded": "Список ещё не загрузился",
  "main.subInactive": "Подписка не активна",
  "main.subActivateKey": "Активируйте ключ",
  "main.serverChosen": "Сервер выбран",
  "main.serverSwitching": "Переключение сервера…",
  "main.trafficExhausted": "Трафик исчерпан",
  "main.trafficExhaustedDesc": "Соединение разорвано. Введите новый ключ.",
  "main.lowTrafficShort": "Осталось менее 10% трафика",

  // vpn states
  "vpn.idle": "Подключиться",
  "vpn.connecting": "Подключение",
  "vpn.connected": "Подключено",
  "vpn.disconnecting": "Отключение",
  "vpn.error": "Повторить",

  // vpn mode switch
  "mode.tun": "Полный туннель",
  "mode.tunDesc": "Весь трафик системы через VPN",
  "mode.proxy": "Только прокси",
  "mode.proxyDesc": "SOCKS5 на 127.0.0.1:10808",
  "mode.disconnectFirst": "Сначала отключитесь",
  "mode.idleOnly": "Режим меняется только в idle",

  // route map
  "map.tunnelActive": "✓ туннель активен",
  "map.notConnected": "не подключено",
  "map.connectingDots": "…",
  "map.detecting": "Определение…",
  "map.unknown": "не определено · повторить",
  "map.refresh": "Обновить локацию",
  "map.you": "ВЫ",

  // servers
  "servers.title": "Серверы",
  "servers.protoAll": "Все",
  "servers.protoVless": "VLESS",
  "servers.protoHysteria2": "Hysteria2",
  "servers.countryAll": "Все страны",
  "servers.notFound": "Серверы не найдены",
  "servers.load": "Нагрузка",
  "servers.couldntLoad": "Не удалось загрузить серверы",

  // profile
  "profile.since": "С нами с",
  "profile.plan": "Текущий тариф",
  "profile.expires": "Действует до",
  "profile.enterKey": "Ввести ключ",
  "profile.extend": "Продлить",
  "profile.history": "Последние подключения",
  "profile.noHistory": "Подключений пока не было",
  "profile.settings": "Настройки",
  "profile.settingsDesc": "Язык, маршрутизация и прочее",
  "profile.logout": "Выйти",
  "profile.logoutTitle": "Выйти из аккаунта?",
  "profile.logoutDesc": "Вы будете отключены от VPN и возвращены на экран входа.",
  "profile.activateKey": "Активация ключа",
  "profile.keyHint": "Введите ключ в формате",
  "profile.invalidFormat": "Неверный формат",
  "profile.keyActivated": "Ключ активирован",

  // settings
  "settings.title": "Настройки",
  "settings.lang": "Язык",
  "settings.langDesc": "Язык интерфейса",
  "settings.routing": "Маршрутизация",
  "settings.routingDesc": "Whitelist/blacklist по доменам, IP, процессам",
  "settings.about": "О программе",
  "settings.version": "Версия",

  // routing
  "routing.title": "Маршрутизация",
  "routing.default": "По умолчанию",
  "routing.defaultDesc": "Куда направлять трафик, для которого не подошло ни одно правило",
  "routing.allViaVpn": "Всё через VPN",
  "routing.allDirect": "Всё напрямую",
  "routing.rules": "Правила",
  "routing.rulesDesc": "Применяются по порядку сверху вниз",
  "routing.empty": "Правил нет. Весь трафик идёт по умолчанию.",
  "routing.kindDomain": "Домен",
  "routing.kindIp": "IP/CIDR",
  "routing.kindProcess": "Процесс",
  "routing.kindRegex": "Regex",
  "routing.actionProxy": "Через VPN",
  "routing.actionDirect": "Напрямую",
  "routing.actionBlock": "Блок",
  "routing.actionShortProxy": "VPN",
  "routing.actionShortDirect": "Direct",
  "routing.actionShortBlock": "Block",
  "routing.value": "Значение",
  "routing.kind": "Тип",
  "routing.action": "Действие",
  "routing.added": "Правило добавлено",
  "routing.enterValue": "Введите значение",
  "routing.hintDomain": "youtube.com или *.youtube.com",
  "routing.hintIp": "8.8.8.8 или 10.0.0.0/8",
  "routing.hintProcess": "имя exe (только VLESS)",
  "routing.hintRegex": "регулярка по домену",
  "routing.note":
    "Полный набор правил (process / domain / regex) работает для VLESS через xray-routing. Для Hysteria2 применяются домены и IP/CIDR.",

  // admin
  "admin.title": "Администрирование",
  "admin.subtitle": "Admin Panel",
  "admin.tabDashboard": "Обзор",
  "admin.tabUsers": "Пользователи",
  "admin.tabKeys": "Ключи",
  "admin.tabServers": "Серверы",
  // dashboard
  "admin.dash.users": "Пользователи",
  "admin.dash.activeSubs": "Активные подписки",
  "admin.dash.keys": "Ключи",
  "admin.dash.usedHint": "использовано",
  "admin.dash.servers": "Серверы",
  "admin.dash.traffic14d": "Трафик за 14 дней",
  "admin.dash.download": "Загрузка",
  "admin.dash.upload": "Отдача",
  "admin.dash.noData": "Нет данных",
  // users
  "admin.users.email": "Email",
  "admin.users.plan": "Тариф",
  "admin.users.traffic": "Трафик",
  "admin.users.expires": "До",
  "admin.users.empty": "Нет пользователей",
  "admin.users.deleteConfirm": "Удалить пользователя",
  "admin.users.deleted": "Удалён",
  "admin.users.adminGranted": "Назначен админ",
  "admin.users.adminRevoked": "Снят админ",
  // keys
  "admin.keys.totalUsed": "Всего {total} · использовано {used}",
  "admin.keys.generate": "Сгенерировать",
  "admin.keys.generateTitle": "Сгенерировать ключи",
  "admin.keys.plan": "Тариф",
  "admin.keys.count": "Количество",
  "admin.keys.kind": "Тариф",
  "admin.keys.status": "Статус",
  "admin.keys.created": "Создан",
  "admin.keys.unused": "не использован",
  "admin.keys.empty": "Нет ключей",
  "admin.keys.deleteConfirm": "Удалить ключ?",
  "admin.keys.generated": "Сгенерировано ключей",
  "admin.keys.copyHint": "Скопируйте — они больше не будут показаны:",
  // servers
  "admin.servers.total": "Всего {n}",
  "admin.servers.add": "Добавить сервер",
  "admin.servers.empty": "Нет серверов",
  "admin.servers.name": "Название",
  "admin.servers.address": "Адрес",
  "admin.servers.protocol": "Протокол",
  "admin.servers.proto": "Proto",
  "admin.servers.load": "Load",
  "admin.servers.on": "On",
  "admin.servers.editTitle": "Редактировать сервер",
  "admin.servers.newTitle": "Новый сервер",
  "admin.servers.country": "Country (ISO)",
  "admin.servers.city": "Город",
  "admin.servers.port": "Порт",
  "admin.servers.params": "Params (JSON)",
  "admin.servers.paramsHint":
    "Для VLESS REALITY: id, flow, network, security:\"reality\", sni, pbk, sid. Для Hysteria2: auth, obfs, tls.",
  "admin.servers.invalidJson": "Невалидный JSON в params",
  "admin.servers.enabled": "Включён",
  "admin.servers.deleteConfirm": "Удалить",
  "admin.servers.added": "Сервер добавлен",
  "admin.servers.saved": "Сохранено",
  "admin.servers.import": "Импорт",
  "admin.servers.importHint": "Вставьте vless://, hy2://, hysteria2:// или JSON-конфиг",
  "admin.servers.importParse": "Распарсить",
  "admin.servers.importApplied": "Поля заполнены из конфига",
  "admin.servers.importFailed": "Не удалось разобрать формат",
};

const en: Record<string, string> = {
  // common
  "common.cancel": "Cancel",
  "common.save": "Save",
  "common.create": "Create",
  "common.delete": "Delete",
  "common.add": "Add",
  "common.refresh": "Refresh",
  "common.close": "Close",
  "common.error": "Error",
  "common.success": "Success",
  "common.loading": "Loading…",
  "common.empty": "Empty",
  "common.back": "Back",
  "common.confirm": "Confirm",
  "common.yes": "Yes",
  "common.no": "No",
  "common.unlimited": "Unlimited",
  "common.copy": "Copy",
  "common.copyAll": "Copy all",
  "common.activate": "Activate",
  "common.edit": "Edit",
  "common.up": "Up",
  "common.down": "Down",

  "tab.main": "Home",
  "tab.servers": "Servers",
  "tab.profile": "Profile",
  "tab.admin": "Admin",

  "splash.subtitle": "Secure connection",

  "login.title": "Sign in to XThing",
  "register.title": "Sign up",
  "login.subtitle": "Enter your email and password",
  "register.subtitle": "Enter credentials and activation key",
  "login.email": "Email",
  "login.password": "Password",
  "login.key": "Activation key",
  "login.submitLogin": "Sign in",
  "login.submitRegister": "Sign up",
  "login.toRegister": "No account? Sign up",
  "login.toLogin": "Already have an account? Sign in",
  "login.errEmail": "Invalid email",
  "login.errPwd": "Minimum 8 characters",
  "login.errKey": "Format: XTHING-XXXX-XXXX-XXXX",
  "login.welcome": "Welcome back",
  "login.created": "Account created",

  "main.account": "Account",
  "main.downloaded": "Downloaded",
  "main.uploaded": "Uploaded",
  "main.lowTraffic": "Less than 10% traffic remaining. Activate a new key in advance.",
  "main.noServers": "No servers",
  "main.notLoaded": "List hasn't loaded yet",
  "main.subInactive": "Subscription inactive",
  "main.subActivateKey": "Activate a key",
  "main.serverChosen": "Server selected",
  "main.serverSwitching": "Switching server…",
  "main.trafficExhausted": "Traffic exhausted",
  "main.trafficExhaustedDesc": "Connection terminated. Enter a new key.",
  "main.lowTrafficShort": "Less than 10% traffic remaining",

  "vpn.idle": "Connect",
  "vpn.connecting": "Connecting",
  "vpn.connected": "Connected",
  "vpn.disconnecting": "Disconnecting",
  "vpn.error": "Retry",

  "mode.tun": "Full tunnel",
  "mode.tunDesc": "All system traffic via VPN",
  "mode.proxy": "Proxy only",
  "mode.proxyDesc": "SOCKS5 on 127.0.0.1:10808",
  "mode.disconnectFirst": "Disconnect first",
  "mode.idleOnly": "Mode can be changed only when idle",

  "map.tunnelActive": "✓ tunnel active",
  "map.notConnected": "not connected",
  "map.connectingDots": "…",
  "map.detecting": "Detecting…",
  "map.unknown": "unknown · retry",
  "map.refresh": "Refresh location",
  "map.you": "YOU",

  "servers.title": "Servers",
  "servers.protoAll": "All",
  "servers.protoVless": "VLESS",
  "servers.protoHysteria2": "Hysteria2",
  "servers.countryAll": "All countries",
  "servers.notFound": "No servers found",
  "servers.load": "Load",
  "servers.couldntLoad": "Couldn't load servers",

  "profile.since": "With us since",
  "profile.plan": "Current plan",
  "profile.expires": "Expires",
  "profile.enterKey": "Enter key",
  "profile.extend": "Extend",
  "profile.history": "Recent connections",
  "profile.noHistory": "No connections yet",
  "profile.settings": "Settings",
  "profile.settingsDesc": "Language, routing and more",
  "profile.logout": "Sign out",
  "profile.logoutTitle": "Sign out?",
  "profile.logoutDesc": "You will be disconnected from VPN and returned to login screen.",
  "profile.activateKey": "Activate key",
  "profile.keyHint": "Enter the key in format",
  "profile.invalidFormat": "Invalid format",
  "profile.keyActivated": "Key activated",

  "settings.title": "Settings",
  "settings.lang": "Language",
  "settings.langDesc": "Interface language",
  "settings.routing": "Routing",
  "settings.routingDesc": "Whitelist/blacklist by domain, IP, process",
  "settings.about": "About",
  "settings.version": "Version",

  "routing.title": "Routing",
  "routing.default": "Default",
  "routing.defaultDesc": "Where to send traffic that doesn't match any rule",
  "routing.allViaVpn": "All via VPN",
  "routing.allDirect": "All direct",
  "routing.rules": "Rules",
  "routing.rulesDesc": "Applied top-to-bottom",
  "routing.empty": "No rules. All traffic uses the default.",
  "routing.kindDomain": "Domain",
  "routing.kindIp": "IP/CIDR",
  "routing.kindProcess": "Process",
  "routing.kindRegex": "Regex",
  "routing.actionProxy": "Via VPN",
  "routing.actionDirect": "Direct",
  "routing.actionBlock": "Block",
  "routing.actionShortProxy": "VPN",
  "routing.actionShortDirect": "Direct",
  "routing.actionShortBlock": "Block",
  "routing.value": "Value",
  "routing.kind": "Type",
  "routing.action": "Action",
  "routing.added": "Rule added",
  "routing.enterValue": "Enter a value",
  "routing.hintDomain": "youtube.com or *.youtube.com",
  "routing.hintIp": "8.8.8.8 or 10.0.0.0/8",
  "routing.hintProcess": "exe name (VLESS only)",
  "routing.hintRegex": "regex on domain",
  "routing.note":
    "Full ruleset (process / domain / regex) works for VLESS via xray-routing. Hysteria2 applies domains and IP/CIDR.",

  "admin.title": "Administration",
  "admin.subtitle": "Admin Panel",
  "admin.tabDashboard": "Overview",
  "admin.tabUsers": "Users",
  "admin.tabKeys": "Keys",
  "admin.tabServers": "Servers",
  "admin.dash.users": "Users",
  "admin.dash.activeSubs": "Active subscriptions",
  "admin.dash.keys": "Keys",
  "admin.dash.usedHint": "used",
  "admin.dash.servers": "Servers",
  "admin.dash.traffic14d": "Traffic for 14 days",
  "admin.dash.download": "Download",
  "admin.dash.upload": "Upload",
  "admin.dash.noData": "No data",
  "admin.users.email": "Email",
  "admin.users.plan": "Plan",
  "admin.users.traffic": "Traffic",
  "admin.users.expires": "Until",
  "admin.users.empty": "No users",
  "admin.users.deleteConfirm": "Delete user",
  "admin.users.deleted": "Deleted",
  "admin.users.adminGranted": "Admin granted",
  "admin.users.adminRevoked": "Admin revoked",
  "admin.keys.totalUsed": "Total {total} · used {used}",
  "admin.keys.generate": "Generate",
  "admin.keys.generateTitle": "Generate keys",
  "admin.keys.plan": "Plan",
  "admin.keys.count": "Count",
  "admin.keys.kind": "Plan",
  "admin.keys.status": "Status",
  "admin.keys.created": "Created",
  "admin.keys.unused": "unused",
  "admin.keys.empty": "No keys",
  "admin.keys.deleteConfirm": "Delete key?",
  "admin.keys.generated": "Keys generated",
  "admin.keys.copyHint": "Copy them now — they won't be shown again:",
  "admin.servers.total": "Total {n}",
  "admin.servers.add": "Add server",
  "admin.servers.empty": "No servers",
  "admin.servers.name": "Name",
  "admin.servers.address": "Address",
  "admin.servers.protocol": "Protocol",
  "admin.servers.proto": "Proto",
  "admin.servers.load": "Load",
  "admin.servers.on": "On",
  "admin.servers.editTitle": "Edit server",
  "admin.servers.newTitle": "New server",
  "admin.servers.country": "Country (ISO)",
  "admin.servers.city": "City",
  "admin.servers.port": "Port",
  "admin.servers.params": "Params (JSON)",
  "admin.servers.paramsHint":
    "VLESS REALITY: id, flow, network, security:\"reality\", sni, pbk, sid. Hysteria2: auth, obfs, tls.",
  "admin.servers.invalidJson": "Invalid JSON in params",
  "admin.servers.enabled": "Enabled",
  "admin.servers.deleteConfirm": "Delete",
  "admin.servers.added": "Server added",
  "admin.servers.saved": "Saved",
  "admin.servers.import": "Import",
  "admin.servers.importHint": "Paste vless://, hy2://, hysteria2:// or JSON config",
  "admin.servers.importParse": "Parse",
  "admin.servers.importApplied": "Fields populated from config",
  "admin.servers.importFailed": "Couldn't parse format",
};

const dict: Record<Lang, Record<string, string>> = { ru, en };

interface I18nStore {
  lang: Lang;
  switching: boolean;
  setLang: (l: Lang) => Promise<void>;
}

export const useI18n = create<I18nStore>((set, get) => ({
  lang: detectLang(),
  switching: false,

  setLang: async (l) => {
    if (get().lang === l || get().switching) return;
    set({ switching: true });
    await new Promise((r) => setTimeout(r, 220));
    set({ lang: l });
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {}
    await new Promise((r) => setTimeout(r, 320));
    set({ switching: false });
  },
}));

/**
 * `t("login.title")` → строка на текущем языке.
 * `t("admin.keys.totalUsed", { total: 12, used: 5 })` — простая интерполяция {key}.
 */
export function useT(): (key: string, vars?: Record<string, string | number>) => string {
  const lang = useI18n((s) => s.lang);
  return (key, vars) => {
    let s = dict[lang][key] ?? key;
    if (vars) {
      for (const k in vars) s = s.replace(`{${k}}`, String(vars[k]));
    }
    return s;
  };
}
