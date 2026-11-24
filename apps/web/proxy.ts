import { type NextRequest, NextResponse } from "next/server";

// Production: only answer requests that came through the Cloudflare Worker (it adds the secret and the
// tenant host). Direct hits on the vercel.app URL get a 404, so nobody can pose as a tenant host there.
// Dev (no secret set): everything passes.
export function proxy(req: NextRequest) {
  const want = process.env.WEB_PROXY_SECRET;
  if (!want) return NextResponse.next();
  const got = req.headers.get("x-proxy-secret") ?? "";
  let diff = got.length ^ want.length;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ (got.charCodeAt(i) || 0);
  return diff === 0 ? NextResponse.next() : new NextResponse("Not found", { status: 404 });
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
