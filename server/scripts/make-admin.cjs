// Альтернатива на Node — для тех, у кого Python не установлен.
// Использует тот же better-sqlite3, что и сервер.
//
// Использование:
//   node server/scripts/make-admin.cjs kseonyt@gmail.com
//   node server/scripts/make-admin.cjs kseonyt@gmail.com --revoke
//   node server/scripts/make-admin.cjs --list

const path = require("node:path");
const fs = require("node:fs");

const dbFile = path.join(__dirname, "..", "data.db");
if (!fs.existsSync(dbFile)) {
  console.error(`БД не найдена: ${dbFile}\nЗапустите сервер хотя бы раз.`);
  process.exit(1);
}

const Database = require("better-sqlite3");
const db = new Database(dbFile);

const args = process.argv.slice(2);
const isList = args.includes("--list");
const isRevoke = args.includes("--revoke");
const email = args.find((a) => !a.startsWith("--"));

if (isList) {
  const rows = db
    .prepare("SELECT email, is_admin, created_at FROM users ORDER BY created_at")
    .all();
  if (!rows.length) {
    console.log("Нет пользователей.");
  } else {
    console.log("admin   email                                    created_at");
    console.log("-".repeat(80));
    for (const r of rows) {
      console.log(`  ${r.is_admin ? "✓ " : "  "}    ${r.email.padEnd(40)} ${r.created_at}`);
    }
  }
  process.exit(0);
}

if (!email) {
  console.error("Использование: node make-admin.cjs <email> [--revoke] | --list");
  process.exit(1);
}

const target = isRevoke ? 0 : 1;
const r = db.prepare("UPDATE users SET is_admin = ? WHERE email = ?").run(target, email);
if (!r.changes) {
  console.error(`Пользователь ${email} не найден`);
  process.exit(1);
}
console.log(
  `✓ ${email} ${isRevoke ? "снят с админа" : "теперь админ"} (обновлено: ${r.changes})`
);
