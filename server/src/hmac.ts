import { timingSafeEqual } from "node:crypto";

const enc = new TextEncoder();

export async function hmacSha256(secret: string, msg: string, out: "hex" | "base64url") {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return Buffer.from(await crypto.subtle.sign("HMAC", key, enc.encode(msg))).toString(out);
}

/** Constant-time string compare; false on any length mismatch. */
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
