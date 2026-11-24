import { timingSafeEqual } from "node:crypto";
import { zValidator } from "@hono/zod-validator";
import { users } from "@jyotish/db";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import { anyUser, type Env, endSession, rateLimit, session, startSession } from "./context";
import { hashPassword, verifyPassword } from "./passwords";
import { sendSms } from "./sms";

export const phone = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, "phone must be E.164, e.g. +919812345678");

const OTP_TTL = 300;
const MAX_TRIES = 5;

export const auth = new Hono<Env>()
  .post("/otp", zValidator("json", z.object({ phone })), async (c) => {
    const tid = c.get("tenant").id;
    const { phone } = c.req.valid("json");
    const cooldown = await c.var.redis.set(`otp-cd:${tid}:${phone}`, "1", { ex: 30, nx: true });
    if (!cooldown || !(await rateLimit(c, `otp:${tid}:${phone}`, 5, 3600)))
      return c.json({ error: "too many requests, try again later" }, 429);

    const code = String(crypto.getRandomValues(new Uint32Array(1))[0]! % 1_000_000).padStart(
      6,
      "0",
    );
    await c.var.redis.set(`otp:${tid}:${phone}`, code, { ex: OTP_TTL });
    await c.var.redis.del(`otp-try:${tid}:${phone}`);
    await sendSms(c.env, phone, `${code} is your ${c.get("tenant").name} login code`);
    return c.json({ sent: true });
  })

  .post(
    "/verify",
    zValidator(
      "json",
      z.object({ phone, code: z.string().regex(/^\d{6}$/), consent: z.boolean().optional() }),
    ),
    async (c) => {
      const tid = c.get("tenant").id;
      const { phone, code, consent } = c.req.valid("json");
      const otpKey = `otp:${tid}:${phone}`;

      const tries = await c.var.redis.incr(`otp-try:${tid}:${phone}`);
      if (tries === 1) await c.var.redis.expire(`otp-try:${tid}:${phone}`, OTP_TTL);
      if (tries > MAX_TRIES) {
        await c.var.redis.del(otpKey);
        return c.json({ error: "too many attempts, request a new code" }, 429);
      }

      const [existing] = await c.var.db.withTenant(tid, (tx) =>
        tx.select().from(users).where(eq(users.phone, phone)),
      );
      // DPDP: a new account needs explicit consent. Checked before the OTP is used up.
      if (!existing && consent !== true) return c.json({ error: "consent required" }, 400);

      const stored = await c.var.redis.get<string>(otpKey);
      if (!stored || !timingSafeEqual(Buffer.from(stored), Buffer.from(code)))
        return c.json({ error: "wrong or expired code" }, 401);
      await c.var.redis.del(otpKey);

      const user =
        existing ??
        (await c.var.db.withTenant(tid, async (tx) => {
          const [u] = await tx
            .insert(users)
            .values({ tenantId: tid, phone, role: "customer", consentAt: new Date() })
            .returning();
          return u!;
        }));
      await startSession(c, { userId: user.id, tenantId: tid, role: user.role });
      return c.json({ user: { id: user.id, role: user.role } });
    },
  )

  .post(
    "/password/login",
    zValidator("json", z.object({ phone, password: z.string().min(1).max(200) })),
    async (c) => {
      const tid = c.get("tenant").id;
      const { phone, password } = c.req.valid("json");
      if (!(await rateLimit(c, `pw:${tid}:${phone}`, 10, 3600)))
        return c.json({ error: "too many attempts, try again later" }, 429);
      const [user] = await c.var.db.withTenant(tid, (tx) =>
        tx.select().from(users).where(eq(users.phone, phone)),
      );
      const ok = user?.passwordHash ? await verifyPassword(password, user.passwordHash) : false;
      if (!user || !ok) return c.json({ error: "wrong phone or password" }, 401);
      await startSession(c, { userId: user.id, tenantId: tid, role: user.role });
      return c.json({ user: { id: user.id, role: user.role } });
    },
  )

  .post(
    "/password",
    anyUser,
    zValidator("json", z.object({ password: z.string().min(10).max(200) })),
    async (c) => {
      const s = session(c);
      const hash = await hashPassword(c.req.valid("json").password);
      await c.var.db.withTenant(s.tenantId, (tx) =>
        tx.update(users).set({ passwordHash: hash }).where(eq(users.id, s.userId)),
      );
      return c.json({ ok: true });
    },
  )

  .post("/logout", async (c) => {
    await endSession(c);
    return c.json({ ok: true });
  });
