import { hmacSha256, safeEqual } from "./hmac";

// Short-lived signed link so the PDF browser (which has no session) can open one report page.

export async function printToken(secret: string, tenantId: string, reportId: string, ttlSec = 120) {
  const exp = Math.floor(Date.now() / 1000) + ttlSec;
  return `${exp}.${await hmacSha256(secret, `${tenantId}.${reportId}.${exp}`, "base64url")}`;
}

export async function checkPrintToken(
  secret: string,
  tenantId: string,
  reportId: string,
  token: string,
) {
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !/^\d+$/.test(exp) || Number(exp) < Date.now() / 1000) return false;
  return safeEqual(sig, await hmacSha256(secret, `${tenantId}.${reportId}.${exp}`, "base64url"));
}
