import { timingSafeEqual } from "node:crypto";
import { argon2idAsync } from "@noble/hashes/argon2.js";

// Pure-JS argon2id: Workers can't compile WASM at runtime. OWASP baseline (19 MiB, t=2, p=1) costs
// ~0.5 s CPU per hash, so this needs the Workers paid plan (the free plan allows 10 ms).
const PARAMS = { m: 19456, t: 2, p: 1 };
const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64").replace(/=+$/, "");

/** PHC string: $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash> */
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await argon2idAsync(password, salt, { ...PARAMS, dkLen: 32 });
  return `$argon2id$v=19$m=${PARAMS.m},t=${PARAMS.t},p=${PARAMS.p}$${b64(salt)}$${b64(hash)}`;
}

export async function verifyPassword(password: string, phc: string) {
  const m = phc.match(
    /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/,
  );
  if (!m) return false;
  const want = Buffer.from(m[5]!, "base64");
  const got = await argon2idAsync(password, Buffer.from(m[4]!, "base64"), {
    m: Number(m[1]),
    t: Number(m[2]),
    p: Number(m[3]),
    dkLen: want.length,
  });
  return got.length === want.length && timingSafeEqual(got, want);
}
