import "dotenv/config";
import crypto from "node:crypto";
import { bootstrap, query } from "./db.js";
import { encryptConfig } from "./crypto.js";
import { generateKey } from "./keys/service.js";

const sample = [
  {
    name: "Frankfurt #1",
    country: "DE",
    city: "Frankfurt",
    protocol: "vless" as const,
    address: "de1.xthing.example",
    port: 443,
    config: {
      id: "00000000-0000-0000-0000-000000000001",
      flow: "xtls-rprx-vision",
      network: "tcp",
      security: "reality",
      sni: "www.cloudflare.com",
      pbk: "REPLACE_WITH_PUBLIC_KEY",
      sid: "deadbeef",
    },
  },
  {
    name: "Amsterdam #1",
    country: "NL",
    city: "Amsterdam",
    protocol: "hysteria2" as const,
    address: "nl1.xthing.example",
    port: 36712,
    config: {
      auth: "REPLACE_WITH_PASSWORD",
      obfs: { type: "salamander", password: "REPLACE_OBFS" },
      tls: { sni: "www.bing.com", insecure: false },
    },
  },
  {
    name: "Singapore #1",
    country: "SG",
    city: "Singapore",
    protocol: "vless" as const,
    address: "sg1.xthing.example",
    port: 443,
    config: {
      id: "00000000-0000-0000-0000-000000000002",
      flow: "xtls-rprx-vision",
      network: "tcp",
      security: "reality",
      sni: "www.microsoft.com",
      pbk: "REPLACE",
      sid: "cafebabe",
    },
  },
];

async function main() {
  await bootstrap();

  for (const s of sample) {
    const payload = encryptConfig(JSON.stringify(s.config));
    const id = crypto.randomUUID();
    const exists = await query(
      `SELECT 1 FROM servers WHERE name = $1`,
      [s.name]
    );
    if (exists.rowCount && exists.rowCount > 0) continue;
    await query(
      `INSERT INTO servers (id, name, country_code, city, protocol, address, port, config_payload, load_percent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        s.name,
        s.country,
        s.city,
        s.protocol,
        s.address,
        s.port,
        payload,
        Math.floor(Math.random() * 70),
      ]
    );
  }
  console.log("Servers seeded.");

  for (const plan of ["trial", "basic", "pro", "unlimited"] as const) {
    const code = await generateKey(plan);
    console.log(`Demo ${plan.padEnd(9)} key:`, code);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
