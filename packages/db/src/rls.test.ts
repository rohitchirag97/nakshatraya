// Cross-tenant isolation test (PRD NFR "Tenant isolation"). Needs Postgres migrated; see README.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq, inArray } from "drizzle-orm";
import { createDb, profiles, tenants, users } from "./index";

const { client, db, withTenant } = createDb(process.env.DATABASE_URL!);

let a: string;
let b: string;
let userA: string;

beforeAll(async () => {
  const suffix = crypto.randomUUID().slice(0, 8);
  const rows = await db
    .insert(tenants)
    .values([
      { slug: `a-${suffix}`, name: "Tenant A" },
      { slug: `b-${suffix}`, name: "Tenant B" },
    ])
    .returning({ id: tenants.id });
  a = rows[0]!.id;
  b = rows[1]!.id;
  userA = await withTenant(a, async (tx) => {
    const [u] = await tx.insert(users).values({ tenantId: a, phone: "+919800000001" }).returning();
    return u!.id;
  });
});

afterAll(async () => {
  // Clean up through each tenant so the deletes pass RLS too.
  for (const t of [a, b]) {
    await withTenant(t, async (tx) => {
      await tx.delete(profiles).where(eq(profiles.tenantId, t));
      await tx.delete(users).where(eq(users.tenantId, t));
    });
  }
  // shortcut: test tenants are left behind (app_user has no DELETE on tenants), fine for CI's throwaway DB.
  await client.end();
});

describe("tenant isolation", () => {
  test("tenant sees its own rows", async () => {
    const rows = await withTenant(a, (tx) => tx.select().from(users));
    expect(rows.map((r) => r.id)).toContain(userA);
  });

  test("other tenant cannot read them", async () => {
    const rows = await withTenant(b, (tx) => tx.select().from(users).where(eq(users.id, userA)));
    expect(rows).toHaveLength(0);
  });

  test("no tenant set reads nothing", async () => {
    const rows = await db
      .select()
      .from(users)
      .where(inArray(users.tenantId, [a, b]));
    expect(rows).toHaveLength(0);
  });

  test("cannot insert a row for another tenant", async () => {
    await expect(
      withTenant(b, (tx) => tx.insert(users).values({ tenantId: a, phone: "+919800000002" })),
    ).rejects.toThrow();
  });

  test("cannot update or delete another tenant's rows", async () => {
    const updated = await withTenant(b, (tx) =>
      tx.update(users).set({ email: "x@x" }).where(eq(users.id, userA)).returning(),
    );
    const deleted = await withTenant(b, (tx) =>
      tx.delete(users).where(eq(users.id, userA)).returning(),
    );
    expect(updated).toHaveLength(0);
    expect(deleted).toHaveLength(0);
  });

  test("cannot reference another tenant's row by id", async () => {
    const profile = {
      tenantId: b,
      userId: userA,
      name: "x",
      gender: "f",
      birthLocal: "2000-01-01T12:00:00",
      birthUtc: new Date(),
      timeKnown: true,
      lat: 0,
      lon: 0,
      tz: "Asia/Kolkata",
    };
    await expect(withTenant(b, (tx) => tx.insert(profiles).values(profile))).rejects.toThrow();
  });

  test("tenant can only update its own tenants row", async () => {
    const other = await withTenant(b, (tx) =>
      tx.update(tenants).set({ name: "hacked" }).where(eq(tenants.id, a)).returning(),
    );
    const own = await withTenant(b, (tx) =>
      tx.update(tenants).set({ name: "Tenant B2" }).where(eq(tenants.id, b)).returning(),
    );
    expect(other).toHaveLength(0);
    expect(own).toHaveLength(1);
  });

  test("setting does not leak past the transaction", async () => {
    await withTenant(a, (tx) => tx.select().from(users));
    const rows = await db.select().from(users).where(eq(users.id, userA));
    expect(rows).toHaveLength(0);
  });

  test("every table with a tenant_id has forced RLS", async () => {
    // tenant_applications is the exception: platform-level, tenant_id is only set once approved.
    const open = await client<{ relname: string }[]>`
      select c.relname from pg_class c
      join pg_attribute a on a.attrelid = c.oid and a.attname = 'tenant_id' and not a.attisdropped
      where c.relkind = 'r' and c.relnamespace = 'public'::regnamespace
        and c.relname <> 'tenant_applications'
        and not (c.relrowsecurity and c.relforcerowsecurity)`;
    expect(open.map((r) => r.relname)).toEqual([]);
  });
});
