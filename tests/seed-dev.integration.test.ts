import { afterAll, describe, expect, it } from "vitest";
import { eq, inArray, sum } from "drizzle-orm";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { assertLocalDatabase } from "@/db/local-only";
import { DEV_ADMIN_EMAIL, DEV_PARTICIPANT_EMAIL, seedDev } from "@/db/seed-dev";
import { badge, company, xpLedger } from "@/db/schema";
import { requireTestEnv } from "./helpers";

describe("dev seed", () => {
  afterAll(async () => {
    await db.delete(company).where(eq(company.slug, "lyfter-demo"));
    await db.delete(user).where(inArray(user.email, [DEV_ADMIN_EMAIL, DEV_PARTICIPANT_EMAIL]));
  });

  it("refuses a non-local database", () => {
    expect(() => assertLocalDatabase("postgresql://u:p@db.example.com/prod")).toThrow(
      "non-local",
    );
  });

  it("is idempotent: a second run adds no badges or XP", async () => {
    requireTestEnv();
    await seedDev();
    const { eventId } = await seedDev();

    const [participant] = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, DEV_PARTICIPANT_EMAIL));
    const [xp] = await db
      .select({ total: sum(xpLedger.amount) })
      .from(xpLedger)
      .where(eq(xpLedger.userId, participant.id));
    const badges = await db.select({ id: badge.id }).from(badge).where(eq(badge.eventId, eventId));

    expect(Number(xp.total)).toBe(150);
    expect(badges).toHaveLength(4);
  });
});
