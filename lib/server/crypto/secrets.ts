import crypto from "crypto";

const keyB64 = process.env.TOKEN_ENC_KEY_BASE64!;
if (!keyB64 || Buffer.from(keyB64, "base64").length !== 32) {
  throw new Error("TOKEN_ENC_KEY_BASE64 must be 32 bytes base64");
}
const KEY = Buffer.from(keyB64, "base64");

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from("v1:"), iv, tag, enc]).toString("base64");
}

export function decrypt(b64: string): string {
  const buf = Buffer.from(b64, "base64");
  if (buf.slice(0, 3).toString() !== "v1:") throw new Error("bad token blob");
  const iv = buf.slice(3, 15);
  const tag = buf.slice(15, 31);
  const enc = buf.slice(31);
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
  return dec.toString("utf8");
}