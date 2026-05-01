// Копируем .sql файлы рядом с скомпилированным db.*.js
const fs = require("node:fs");
const path = require("node:path");

const src = path.join(__dirname, "..", "src");
const dst = path.join(__dirname, "..", "dist");
fs.mkdirSync(dst, { recursive: true });

for (const f of fs.readdirSync(src)) {
  if (f.endsWith(".sql")) {
    fs.copyFileSync(path.join(src, f), path.join(dst, f));
    console.log("[copy-sql]", f);
  }
}
