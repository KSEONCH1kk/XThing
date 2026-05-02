// AES-256-GCM дешифровка симметрична server/src/crypto.ts и
// electron/src/crypto.ts: формат base64(iv[12] | tag[16] | cipher).
//
// Используем WebCrypto (SubtleCrypto), доступный и в Capacitor WebView, и
// в обычном браузере, чтобы не тащить node:crypto.
//
// TS 5.7+ сделал TypedArray generic'ом над буфером (ArrayBuffer vs
// SharedArrayBuffer). WebCrypto API хочет именно ArrayBuffer-вариант, и
// `subarray()` возвращает `<ArrayBufferLike>`, что компилятор отбивает.
// Поэтому: создаём массивы через `new Uint8Array(length)` (его перегрузка
// возвращает `<ArrayBuffer>`), а резать — через `.slice()` (тоже `<ArrayBuffer>`).

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  if (hex.length % 2 !== 0) throw new Error("hex key must have even length");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return out;
}

export async function decryptConfig(payload: string, hexKey: string): Promise<string> {
  const buf = b64ToBytes(payload);
  if (buf.length < 12 + 16) throw new Error("payload too short for AES-GCM");

  // .slice() копирует данные и возвращает Uint8Array<ArrayBuffer>,
  // в отличие от .subarray(), который сохраняет ArrayBufferLike.
  const iv = buf.slice(0, 12);
  const tag = buf.slice(12, 28);
  const cipher = buf.slice(28);

  // WebCrypto ждёт ciphertext с приклеенным authTag в хвосте.
  const ctWithTag = new Uint8Array(cipher.length + tag.length);
  ctWithTag.set(cipher, 0);
  ctWithTag.set(tag, cipher.length);

  const keyBytes = hexToBytes(hexKey);
  if (keyBytes.length !== 32) throw new Error("AES key must be 32 bytes (64 hex)");

  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv, tagLength: 128 }, key, ctWithTag);
  return new TextDecoder("utf-8").decode(plain);
}
