import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@jyotish/engine"],
  agentRules: false,
  // Production: Cloudflare routes <tenant>/api/* to the Worker, so the browser stays same-origin.
  // Dev: proxy /api to `wrangler dev` (which trusts X-Forwarded-Host for the tenant).
  async rewrites() {
    if (process.env.NODE_ENV !== "development") return [];
    const api = process.env.API_ORIGIN ?? "http://localhost:8787";
    return [{ source: "/api/:path*", destination: `${api}/api/:path*` }];
  },
  // shortcut: no Content-Security-Policy yet (Razorpay Checkout loads scripts and frames from its
  // domains); add one with those origins before scaling past the pilots.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // SAMEORIGIN, not DENY: the print page previews the PDF in a same-origin frame.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default config;
