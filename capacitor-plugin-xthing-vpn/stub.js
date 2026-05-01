// Этот файл намеренно пустой.
//
// JS-часть плагина (registerPlugin) живёт в основном клиенте:
//   client/src/lib/vpn-android.ts
// Этот npm-пакет нужен только для того, чтобы Capacitor CLI обнаружил
// нативный Android-модуль через поле "capacitor.android.src" в package.json
// при запуске `npx cap sync android`.
module.exports = {};
