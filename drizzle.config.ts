import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: ["./auth-schema.ts", "./db/schema.ts"],
  out: "./db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
