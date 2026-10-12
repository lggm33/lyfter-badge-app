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
import { badge, badgeRedemption, company, event, eventMembership, xpLedger } from "@/db/schema";
import { cookieHeader, postAuth, requireTestEnv, uniqueEmail } from "./helpers";

const password = "integration-test-password";
const ownerEmail = uniqueEmail("collection-owner");
const otherEmail = uniqueEmail("collection-other");
const companyId = randomUUID();
const eventId = randomUUID();
const emptyEventId = randomUUID();
const badgeId = randomUUID();
const olderBadgeId = randomUUID();
const redemptionId = randomUUID();
const olderRedemptionId = randomUUID();
const olderRedeemedAt = new Date("2026-01-01T10:00:00.000Z");
const emptyCheckedInAt = new Date("2026-01-02T10:00:00.000Z");
const newerRedeemedAt = new Date("2026-01-03T10:00:00.000Z");

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
    await db.insert(event).values([
      {
        id: eventId,
        companyId,
        name: "Demo Day",
        slug: `evt-${eventId}`,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
        status: "ACTIVE",
      },
      {
        id: emptyEventId,
        companyId,
        name: "Open Day",
        slug: `evt-${emptyEventId}`,
        startsAt: new Date(),
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
        status: "ACTIVE",
      },
    ]);
    await db.insert(eventMembership).values({
      id: randomUUID(),
      eventId: emptyEventId,
      userId: ownerId,
      checkedInAt: emptyCheckedInAt,
    });
    await db.insert(badge).values([
      {
        id: badgeId,
        eventId,
        name: "Stand QR",
        icon: "★",
        type: "stand",
        rarity: "common",
        xp: 100,
        required: true,
      },
      {
        id: olderBadgeId,
        eventId,
        name: "Talk QR",
        icon: null,
        type: "talk",
        rarity: "common",
        xp: 999,
        required: true,
      },
    ]);
    await db.insert(badgeRedemption).values([
      {
        id: redemptionId,
        badgeId,
        eventId,
        userId: ownerId,
        createdAt: newerRedeemedAt,
      },
      {
        id: olderRedemptionId,
        badgeId: olderBadgeId,
        eventId,
        userId: ownerId,
        createdAt: olderRedeemedAt,
      },
    ]);
    await db.insert(xpLedger).values([
      {
        id: randomUUID(),
        redemptionId,
        userId: ownerId,
        amount: 40,
      },
      {
        id: randomUUID(),
        redemptionId: olderRedemptionId,
        userId: ownerId,
        amount: 15,
      },
    ]);
  });

  afterAll(async () => {
    await db.delete(company).where(eq(company.id, companyId));
    await db.delete(user).where(eq(user.email, ownerEmail));
    await db.delete(user).where(eq(user.email, otherEmail));
  });

  it("agrupa por evento y suma el XP del ledger, no el XP del badge", async () => {
    headersMock.mockResolvedValueOnce(new Headers({ cookie: ownerCookie }));

    const collection = await listMyCollection();

    expect(collection.totalXp).toBe(55);
    expect(collection.events.map((item) => item.eventId)).toEqual([eventId, emptyEventId]);
    expect(collection.events[0]).toMatchObject({
      eventName: "Demo Day",
      xp: 55,
      badges: [
        { redemptionId, badgeId, name: "Stand QR", icon: "★", xp: 40 },
        { redemptionId: olderRedemptionId, badgeId: olderBadgeId, name: "Talk QR", icon: null, xp: 15 },
      ],
    });
    expect(collection.events[1]).toMatchObject({
      eventId: emptyEventId,
      eventName: "Open Day",
      xp: 0,
      badges: [],
    });

    headersMock.mockResolvedValueOnce(new Headers({ cookie: ownerCookie }));
    await expect(getMyBadge(badgeId)).resolves.toMatchObject({
      name: "Stand QR",
      xp: 40,
    });
  });

  it("no muestra la colección de otra persona", async () => {
    headersMock.mockResolvedValueOnce(new Headers({ cookie: otherCookie }));

    await expect(listMyCollection()).resolves.toEqual({ totalXp: 0, events: [] });

    headersMock.mockResolvedValueOnce(new Headers({ cookie: otherCookie }));
    await expect(getMyBadge(badgeId)).resolves.toBeNull();
  });
});
