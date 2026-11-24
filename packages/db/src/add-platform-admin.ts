// Makes a phone number a platform owner: they can log in to /platform with an OTP on that phone.
//   bun run platform:add-admin +917069021206            add
//   bun run platform:add-admin --remove +917069021206   remove
// Runs as the database owner (DATABASE_OWNER_URL): the app role can only read platform_admins.
import postgres from "postgres";

const args = process.argv.slice(2);
const remove = args.includes("--remove");
const phone = args.find((a) => !a.startsWith("--"));
if (!phone || !/^\+[1-9]\d{7,14}$/.test(phone)) {
  console.error("usage: bun run platform:add-admin [--remove] +91XXXXXXXXXX (E.164)");
  process.exit(1);
}
const url = process.env.DATABASE_OWNER_URL;
if (!url) throw new Error("DATABASE_OWNER_URL is not set");

const sql = postgres(url, { max: 1 });
if (remove) {
  const r = await sql`delete from platform_admins where phone = ${phone}`;
  console.log(r.count ? `removed ${phone}` : `${phone} was not a platform admin`);
} else {
  await sql`insert into platform_admins (phone) values (${phone}) on conflict do nothing`;
  console.log(`${phone} is a platform owner; log in at /platform on the platform domain`);
}
const all = await sql<{ phone: string }[]>`select phone from platform_admins order by created_at`;
console.log(`platform admins: ${all.map((a) => a.phone).join(", ") || "(none)"}`);
await sql.end();
