import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * One connection set per caller. On Workers that's per request (Hyperdrive pools for us);
 * scripts and tests make one for the process. Call `client.end()` when done.
 */
export function createDb(url: string) {
  // fetch_types off: Hyperdrive guidance, and we use no custom types.
  const client = postgres(url, { max: 5, fetch_types: false });
  // Only for tables outside RLS (tenants, places, content). Tenant data goes through withTenant.
  const db = drizzle(client, { schema });

  /** The only way to read or write tenant data: RLS sees app.tenant_id for this transaction only. */
  function withTenant<T>(tenantId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
    if (!UUID.test(tenantId)) throw new Error("withTenant: invalid tenant id");
    return db.transaction(async (tx) => {
      await tx.execute(sql`select set_config('app.tenant_id', ${tenantId}, true)`);
      return fn(tx);
    });
  }

  return { client, db, withTenant };
}

export type Db = ReturnType<typeof createDb>;
export type Tx = Parameters<Parameters<Db["db"]["transaction"]>[0]>[0];
