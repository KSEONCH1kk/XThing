/**
 * Добавить серверы в БД (идемпотентно, апсерчит по name).
 *
 * Запуск: npm --workspace server run add-server
 *
 * Чтобы добавить свой — допишите запись в массив SERVERS ниже.
 *
 * VLESS:     params: { id, flow?, network?, security?, sni?, pbk?, sid?, fp? }
 * Hysteria2: params: { auth, obfs?: { type, password }, tls?: { sni, insecure? } }
 */
import "dotenv/config";
// @ts-ignore
import crypto from "node:crypto";
import { bootstrap, query } from "../src/db.js";
import { encryptConfig } from "../src/crypto.js";

interface ServerInput {
  name: string;
  country_code: string;
  city: string;
  protocol: "vless" | "hysteria2";
  address: string;
  port: number;
  loadPercent?: number;
  params: Record<string, any>;
}

const SERVERS: ServerInput[] = [
  {
    name: "🇩🇪 hysteria2-udp",
    country_code: "DE",
    city: "Frankfurt",
    protocol: "hysteria2",
    address: "sobaka.intave.tech",
    port: 443,
    loadPercent: 12,
    params: {
      auth: "drgdgagdfjughriuoahguh",
      obfs: { type: "salamander", password: "drgdgagdfjughriuoahguh" },
      tls: { sni: "sobaka.intave.tech", insecure: false },
    },
  },
  {
    name: "🇩🇪 vless-tcp-reality",
    country_code: "DE",
    city: "Frankfurt",
    protocol: "vless",
    address: "sobaka.intave.tech",
    port: 54552,
    loadPercent: 18,
    params: {
      id: "b0287cc6-f96a-45bc-8256-7ce4585200ba",
      flow: "xtls-rprx-vision",
      network: "tcp",
      security: "reality",
      sni: "max.ru",
      pbk: "-U-vLGP_hFdDw7kXgC1dy5slaFnBcmcEGG7Iudv8rD0",
      sid: "92593049",
      fp: "random",
    },
  },
];

async function upsert(s: ServerInput) {
  const payload = encryptConfig(JSON.stringify(s.params));
  const existing = await query<{ id: string }>(`SELECT id FROM servers WHERE name = $1`, [s.name]);

  if (existing.rowCount && existing.rowCount > 0) {
    await query(
      `UPDATE servers
       SET country_code = $1, city = $2, protocol = $3, address = $4, port = $5,
           config_payload = $6, load_percent = $7
       WHERE name = $8`,
      [
        s.country_code,
        s.city,
        s.protocol,
        s.address,
        s.port,
        payload,
        s.loadPercent ?? 0,
        s.name,
      ]
    );
    console.log(`✓ Обновлён: ${s.name}`);
  } else {
    const id = crypto.randomUUID();
    await query(
      `INSERT INTO servers (id, name, country_code, city, protocol, address, port, config_payload, load_percent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        id,
        s.name,
        s.country_code,
        s.city,
        s.protocol,
        s.address,
        s.port,
        payload,
        s.loadPercent ?? 0,
      ]
    );
    console.log(`✓ Добавлен: ${s.name}`);
  }
}

async function main() {
  await bootstrap();
  for (const s of SERVERS) {
    try {
      await upsert(s);
    } catch (e: any) {
      console.error(`✗ ${s.name}: ${e?.message || e}`);
    }
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
