// Копируем .proto файлы в dist рядом с скомпилированными .js
const fs = require("node:fs");
const path = require("node:path");

const src = path.join(__dirname, "..", "src", "vpn", "stats", "xray.proto");
const dstDir = path.join(__dirname, "..", "dist", "vpn", "stats");
fs.mkdirSync(dstDir, { recursive: true });
fs.copyFileSync(src, path.join(dstDir, "xray.proto"));
console.log("[copy-proto] xray.proto -> dist/vpn/stats/");
