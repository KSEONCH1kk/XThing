import crypto from "node:crypto";

// Симметричен server/src/crypto.ts (AES-256-GCM, base64(iv|tag|cipher))
export function decryptConfig(payload: string, hexKey: string): string {
  const KEY = Buffer.from(hexKey, "hex");
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}
