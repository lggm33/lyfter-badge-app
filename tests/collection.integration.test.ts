import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const headersMock = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
}));

import { getMyBadge, listMyCollection } from "@/app/(protected)/home/actions";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { badge, badgeRedemption, company, event, xpLedger } from "@/db/schema";
import { cookieHeader, postAuth, requireTestEnv, uniqueEmail } from "./helpers";

const password = "integration-test-password";
const ownerEmail = uniqueEmail("collection-owner");
const otherEmail = uniqueEmail("collection-other");
const companyId = randomUUID();
const eventId = randomUUID();
const badgeId = randomUUID();
const redemptionId = randomUUID();

let ownerId = "";
let ownerCookie = "";
let otherCookie = "";

describe("participant collection", () => {
  beforeAll(async () => {
    requireTestEnv();
    const ownerSignUp = await postAuth("/sign-up/email", { name: "Collector", email: ownerEmail, password });
    const otherSignUp = await postAuth("/sign-up/email", { name: "Other", email: otherEmail, password });
    expect(ownerSignUp.status).toBe(200);
    expect(otherSignUp.status).toBe(200);
    ownerId = (await ownerSignUp.json()).user.id;

    const ownerSignIn = await postAuth("/sign-in/email", { email: ownerEmail, password });
    const otherSignIn = await postAuth("/sign-in/email", { email: otherEmail, password });
    ownerCookie = cookieHeader(ownerSignIn);
    otherCookie = cookieHeader(otherSignIn);

    await db.insert(company).values({ id: companyId, name: "Collection Co", slug: `collection-${companyId}` });
    await db.insert(event).values({
      id: eventId,
      companyId,
      name: "Demo Day",
      slug: `evt-${eventId}`,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
      status: "ACTIVE",
    });
    await db.insert(badge).values({
      id: badgeId,
      eventId,
      name: "Stand QR",
      icon: "★",
      type: "stand",
      rarity: "common",
      xp: 100,
      required: true,
    });
    await db.insert(badgeRedemption).values({
      id: redemptionId,
      badgeId,
      eventId,
      userId: ownerId,
    });
    await db.insert(xpLedger).values({
      id: randomUUID(),
      redemptionId,
      userId: ownerId,
      amount: 40,
    });
  });

  afterAll(async () => {
    await db.delete(company).where(eq(company.id, companyId));
    await db.delete(user).where(eq(user.email, ownerEmail));
    await db.delete(user).where(eq(user.email, otherEmail));
  });

  it("lista el badge y suma el XP del ledger, no el XP del badge", async () => {
    headersMock.mockResolvedValueOnce(new Headers({ cookie: ownerCookie }));

    const collection = await listMyCollection();

    expect(collection.totalXp).toBe(40);
    expect(collection.badges).toEqual([
      expect.objectContaining({
        redemptionId,
        badgeId,
        name: "Stand QR",
        icon: "★",
        eventName: "Demo Day",
        xp: 40,
      }),
    ]);

    headersMock.mockResolvedValueOnce(new Headers({ cookie: ownerCookie }));
    await expect(getMyBadge(badgeId)).resolves.toMatchObject({
      name: "Stand QR",
      xp: 40,
    });
  });

  it("no muestra la colección de otra persona", async () => {
    headersMock.mockResolvedValueOnce(new Headers({ cookie: otherCookie }));

    await expect(listMyCollection()).resolves.toEqual({ totalXp: 0, badges: [] });

    headersMock.mockResolvedValueOnce(new Headers({ cookie: otherCookie }));
    await expect(getMyBadge(badgeId)).resolves.toBeNull();
  });
});
