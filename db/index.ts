import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as authSchema from "@/auth-schema";
import * as appSchema from "@/db/schema";

const globalForDb = globalThis as unknown as {
  pool: Pool | undefined;
};

function createPool() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  return new Pool({
    connectionString: databaseUrl,
  });
}

function getPool() {
  if (globalForDb.pool) {
    return globalForDb.pool;
  }

  const pool = createPool();

  if (process.env.NODE_ENV !== "production") {
    globalForDb.pool = pool;
  }

  return pool;
}

export const db = drizzle({
  client: getPool(),
  schema: { ...authSchema, ...appSchema },
});
