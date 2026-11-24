import { zValidator } from "@hono/zod-validator";
import { charts, type Db, orders, places, profiles, reports, users } from "@jyotish/db";
import { searchPlaces } from "@jyotish/db/geonames";
import { toUtc } from "@jyotish/engine";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { anyUser, type Env, endSession, type Session, session } from "./context";

type Profile = typeof profiles.$inferSelect;
// Customers see their own profiles; owner and astrologers see the tenant's (FR-21).
const canSee = (s: Session, p: Profile) => s.role !== "customer" || p.userId === s.userId;
const mine = (s: Session) =>
  s.role === "customer" ? eq(profiles.userId, s.userId) : eq(profiles.tenantId, s.tenantId);

const birth = z.object({
  name: z.string().trim().min(1).max(100),
  gender: z.enum(["male", "female", "other"]),
  date: z.iso.date(),
  time: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(), // null = time unknown (FR-1)
  placeId: z.number().int().positive(),
});

export const placeRoutes = new Hono<Env>().get(
  "/",
  zValidator("query", z.object({ q: z.string().trim().min(2).max(60) })),
  async (c) => c.json(await searchPlaces(c.var.db.db, c.req.valid("query").q)),
);

export const profileRoutes = new Hono<Env>()
  .use(anyUser)
  .get("/", async (c) => {
    const s = session(c);
    return c.json(
      await c.var.db.withTenant(s.tenantId, (tx) => tx.select().from(profiles).where(mine(s))),
    );
  })

  .post("/", zValidator("json", birth), async (c) => {
    const s = session(c);
    const b = c.req.valid("json");
    const year = Number(b.date.slice(0, 4));
    if (year < 1800 || year > new Date().getFullYear())
      return c.json({ error: "birth year out of range" }, 400);
    const [place] = await c.var.db.db.select().from(places).where(eq(places.id, b.placeId));
    if (!place) return c.json({ error: "unknown place" }, 400);

    // Unknown time: noon keeps the Moon within ~6.5° of the truth; lagna sections are dropped later.
    const local = `${b.date}T${b.time ?? "12:00"}`;
    let birthUtc: Date;
    try {
      birthUtc = toUtc(local, place.tz);
    } catch {
      return c.json({ error: "invalid birth date or time" }, 400);
    }
    const [p] = await c.var.db.withTenant(s.tenantId, (tx) =>
      tx
        .insert(profiles)
        .values({
          tenantId: s.tenantId,
          userId: s.userId,
          name: b.name,
          gender: b.gender,
          birthLocal: `${local}:00`,
          birthUtc,
          timeKnown: b.time !== null,
          placeId: place.id,
          lat: place.lat,
          lon: place.lon,
          tz: place.tz,
        })
        .returning(),
    );
    return c.json(p, 201);
  })

  .get("/:id", async (c) => {
    const s = session(c);
    const p = await findProfile(c.var.db, s, c.req.param("id"));
    return p ? c.json(p) : c.json({ error: "not found" }, 404);
  })

  .delete("/:id", async (c) => {
    const s = session(c);
    const p = await findProfile(c.var.db, s, c.req.param("id"));
    if (!p) return c.json({ error: "not found" }, 404);
    await c.var.db.withTenant(s.tenantId, (tx) => tx.delete(profiles).where(eq(profiles.id, p.id)));
    return c.body(null, 204);
  });

export async function findProfile({ withTenant }: Db, s: Session, id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const [p] = await withTenant(s.tenantId, (tx) =>
    tx.select().from(profiles).where(eq(profiles.id, id)),
  );
  return p && canSee(s, p) ? p : null;
}

// DPDP: a customer can export and delete their own data.
export const meRoutes = new Hono<Env>()
  .use(anyUser)
  // Who is logged in (for the site header: which links to show).
  .get("/", async (c) => {
    const s = session(c);
    const [u] = await c.var.db.withTenant(s.tenantId, (tx) =>
      tx.select({ phone: users.phone }).from(users).where(eq(users.id, s.userId)),
    );
    return u
      ? c.json({ id: s.userId, role: s.role, phone: u.phone })
      : c.json({ error: "login required" }, 401);
  })
  .get("/export", async (c) => {
    const s = session(c);
    const data = await c.var.db.withTenant(s.tenantId, async (tx) => {
      const [user] = await tx.select().from(users).where(eq(users.id, s.userId));
      const ps = await tx.select().from(profiles).where(eq(profiles.userId, s.userId));
      const cs = ps.length
        ? await tx
            .select()
            .from(charts)
            .where(
              inArray(
                charts.profileId,
                ps.map((p) => p.id),
              ),
            )
        : [];
      const rs = cs.length
        ? await tx
            .select()
            .from(reports)
            .where(
              inArray(
                reports.chartId,
                cs.map((ch) => ch.id),
              ),
            )
        : [];
      const { passwordHash: _, ...safeUser } = user!;
      return { user: safeUser, profiles: ps, charts: cs, reports: rs };
    });
    c.header("content-disposition", 'attachment; filename="my-data.json"');
    return c.json(data);
  })

  .delete("/", async (c) => {
    const s = session(c);
    if (s.role === "owner") return c.json({ error: "an owner account can't delete itself" }, 400);
    // Cascades to profiles, charts and reports; orders stay as tax records with report_id nulled,
    // minus the delivery address (personal data not needed for tax).
    await c.var.db.withTenant(s.tenantId, async (tx) => {
      await tx
        .update(orders)
        .set({
          shipName: null,
          shipPhone: null,
          shipAddress: null,
          shipCity: null,
          shipState: null,
          shipPincode: null,
        })
        .where(eq(orders.userId, s.userId));
      await tx.delete(users).where(and(eq(users.id, s.userId), eq(users.tenantId, s.tenantId)));
    });
    await endSession(c);
    return c.body(null, 204);
  });
