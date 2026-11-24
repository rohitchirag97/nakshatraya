"use client";

/** Same-origin call to the API from the browser (cookie goes along; CSRF check sees our Origin). */
export async function send(path: string, body?: unknown, method = "POST") {
  const res = await fetch(path, {
    method,
    headers: body === undefined ? {} : { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}
