// Load test for the pilot gate: report JSON (target < 1 s) and fresh PDF generation (target p95 < 10 s).
// Creates new staff reports first, so every PDF is really rendered, not served from storage.
//
//   bun scripts/load-test.ts --base https://demo.ourapp.in --sid <owner or astrologer session> \
//     --profile <profile id> [--pdfs 20] [--concurrency 4] [--pages 100]
// Local dev: --base http://localhost:8787 --host demo.localhost (sent as X-Forwarded-Host).
// Each PDF is a real Browser Rendering session: mind the account's concurrency limit and cost.
import { parseArgs } from "node:util";

export function percentile(sorted: number[], p: number) {
  if (!sorted.length) return Number.NaN;
  return sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)]!;
}

async function pool<T>(items: T[], n: number, fn: (x: T) => Promise<void>) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: n }, async () => {
      for (let x = queue.shift(); x !== undefined; x = queue.shift()) await fn(x);
    }),
  );
}

async function main() {
  const { values: a } = parseArgs({
    options: {
      base: { type: "string" },
      host: { type: "string" },
      sid: { type: "string" },
      profile: { type: "string" },
      lang: { type: "string", default: "en" },
      pdfs: { type: "string", default: "10" },
      concurrency: { type: "string", default: "3" },
      pages: { type: "string", default: "50" },
    },
  });
  if (!a.base || !a.sid || !a.profile) {
    console.error(
      "usage: --base <url> --sid <session> --profile <id> [--host h] [--pdfs n] [--concurrency c] [--pages n]",
    );
    process.exit(1);
  }
  const headers: Record<string, string> = {
    cookie: `sid=${a.sid}`,
    "content-type": "application/json",
  };
  if (a.host) headers["x-forwarded-host"] = a.host;
  const api = (path: string, init: RequestInit = {}) =>
    fetch(`${a.base}/api${path}`, { ...init, headers });

  async function measure(
    label: string,
    ids: string[],
    path: (id: string) => string,
    target: number,
  ) {
    const times: number[] = [];
    const statuses: Record<number, number> = {};
    await pool(ids, Number(a.concurrency), async (id) => {
      const t = performance.now();
      const res = await api(path(id));
      await res.arrayBuffer();
      times.push(performance.now() - t);
      statuses[res.status] = (statuses[res.status] ?? 0) + 1;
    });
    times.sort((x, y) => x - y);
    const p95 = percentile(times, 95);
    console.log(
      `${label}: n=${times.length} p50=${percentile(times, 50).toFixed(0)}ms p95=${p95.toFixed(0)}ms ` +
        `max=${times.at(-1)?.toFixed(0)}ms statuses=${JSON.stringify(statuses)} ` +
        `${p95 < target ? "PASS" : "FAIL"} (target p95 < ${target}ms)`,
    );
  }

  const reports: string[] = [];
  for (let i = 0; i < Number(a.pdfs); i++) {
    const r = await api("/reports", {
      method: "POST",
      body: JSON.stringify({ profileId: a.profile, lang: a.lang }),
    });
    if (!r.ok) throw new Error(`creating report: ${r.status} ${await r.text()}`);
    reports.push((await r.json()).id);
  }
  const pages = Array.from({ length: Number(a.pages) }, (_, i) => reports[i % reports.length]!);
  await measure("report JSON", pages, (id) => `/reports/${id}`, 1000);
  // 503 = Browser Rendering at its concurrency limit: the client is told to retry, not shown an error.
  await measure("fresh PDF  ", reports, (id) => `/reports/${id}/pdf`, 10_000);
}

if (import.meta.main) await main();
