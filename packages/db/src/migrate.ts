import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Runs as the owner so app_user never owns tables (owners bypass RLS).
const url = process.env.DATABASE_OWNER_URL;
if (!url) throw new Error("DATABASE_OWNER_URL is not set");

const client = postgres(url, { max: 1 });
await migrate(drizzle(client), { migrationsFolder: `${import.meta.dir}/../drizzle` });
await client.end();
console.log("migrations applied");
