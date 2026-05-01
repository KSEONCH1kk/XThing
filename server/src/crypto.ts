import crypto from "node:crypto";
import { env } from "./env.js";

const KEY = Buffer.from(env.SERVER_CONFIG_AES_KEY, "hex");

// AES-256-GCM. Output format: base64(iv | tag | ciphertext)
export function encryptConfig(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptConfig(payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

export function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function randomKeyCode(): string {
  // XTHING-XXXX-XXXX-XXXX (16 char chunks of A-Z0-9 minus ambiguous)
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const chunk = () =>
    Array.from(crypto.randomBytes(4))
      .map((b) => alphabet[b % alphabet.length])
      .join("");
  return `XTHING-${chunk()}-${chunk()}-${chunk()}`;
}
