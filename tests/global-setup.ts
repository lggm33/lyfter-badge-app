import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";
import { assertLocalDatabase } from "../db/local-only";

export default async function setup() {
  const pool = new Pool({ connectionString: assertLocalDatabase(process.env.DATABASE_URL) });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: "./db/migrations" });
  } finally {
    await pool.end();
  }
}
