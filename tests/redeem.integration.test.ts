import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { redeemBadge } from "@/app/lib/redeem";
import { QR_GRACE_WINDOWS, QR_WINDOW_SECONDS, signQrToken } from "@/app/lib/qr-token";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { badge, badgeRedemption, company, event, eventMembership, xpLedger } from "@/db/schema";
import { postAuth, requireTestEnv, uniqueEmail } from "./helpers";

const password = "integration-test-password";
const email = uniqueEmail("redeem");
const levelEmail = uniqueEmail("level-up");
const companyId = randomUUID();
let userId = "";
let levelUserId = "";

function shift(windows: number) {
  return new Date(Date.now() + windows * QR_WINDOW_SECONDS * 1000);
}

async function openEvent() {
  const eventId = randomUUID();
  await db.insert(event).values({
    id: eventId,
    companyId,
    name: "Demo Day",
    slug: `evt-${eventId}`,
    startsAt: shift(-1),
    endsAt: shift(120),
    status: "ACTIVE",
  });
  return eventId;
}

async function addBadge(eventId: string, xp = 100) {
  const badgeId = randomUUID();
  await db.insert(badge).values({
    id: badgeId,
    eventId,
    name: "Stand QR",
    type: "stand",
    rarity: "common",
    xp,
    required: true,
  });
  return badgeId;
}

async function checkIn(eventId: string) {
  await db.insert(eventMembership).values({
    id: randomUUID(),
    eventId,
    userId,
  });
}

describe("badge redemption", () => {
  beforeAll(async () => {
    requireTestEnv();
    if (!process.env.QR_SECRET) throw new Error("QR_SECRET must be set to run the redeem test");
    const signUp = await postAuth("/sign-up/email", { name: "Redeemer", email, password });
    expect(signUp.status).toBe(200);
    userId = (await signUp.json()).user.id;
    const levelSignUp = await postAuth("/sign-up/email", { name: "Level Up", email: levelEmail, password });
    expect(levelSignUp.status).toBe(200);
    levelUserId = (await levelSignUp.json()).user.id;
    await db.insert(company).values({ id: companyId, name: "Redeem Co", slug: `redeem-${companyId}` });
  });

  afterAll(async () => {
    await db.delete(company).where(eq(company.id, companyId));
    await db.delete(user).where(eq(user.email, email));
    await db.delete(user).where(eq(user.email, levelEmail));
  });

  it("otorga el badge y escribe el XP una sola vez", async () => {
    const eventId = await openEvent();
    const badgeId = await addBadge(eventId, 250);
    await checkIn(eventId);
    const token = signQrToken({ kind: "badge", subjectId: badgeId });

    const first = await redeemBadge(token, userId);
    const second = await redeemBadge(signQrToken({ kind: "badge", subjectId: badgeId }, shift(-1)), userId);
    const redemptions = await db.select().from(badgeRedemption).where(eq(badgeRedemption.badgeId, badgeId));
    const ledger = await db.select().from(xpLedger).where(eq(xpLedger.userId, userId));
    const forThisBadge = ledger.filter((row) => redemptions.some((item) => item.id === row.redemptionId));

    expect(first).toEqual({
      ok: true,
      outcome: "granted",
      badgeId,
      badgeName: "Stand QR",
      eventName: "Demo Day",
      xp: 250,
      levelUpTo: 3,
      totalXpAfter: 250,
    });
    expect(second).toMatchObject({ ok: true, outcome: "already_redeemed", xp: 250, levelUpTo: null, totalXpAfter: null });
    expect(redemptions).toHaveLength(1);
    expect(forThisBadge).toEqual([expect.objectContaining({ amount: 250 })]);
  });

  it("anota el evento del badge aunque la persona ya esté en otro", async () => {
    const eventA = await openEvent();
    const eventB = await openEvent();
    const badgeId = await addBadge(eventB, 40);
    await checkIn(eventA);
    const token = signQrToken({ kind: "badge", subjectId: badgeId });

    const result = await redeemBadge(token, userId);
    const attendance = await db
      .select()
      .from(eventMembership)
      .where(eq(eventMembership.eventId, eventB));
    const mine = attendance.filter((row) => row.userId === userId);
    const redemptions = await db.select().from(badgeRedemption).where(eq(badgeRedemption.badgeId, badgeId));

    expect(result).toEqual({
      ok: true,
      outcome: "granted",
      badgeId,
      badgeName: "Stand QR",
      eventName: "Demo Day",
      xp: 40,
      levelUpTo: null,
      totalXpAfter: 40,
    });
    expect(mine).toHaveLength(1);
    expect(redemptions).toHaveLength(1);
  });

  it("registra un solo nivel alcanzado cuando dos canjes cruzan el umbral en paralelo", async () => {
    const eventA = await openEvent();
    const eventB = await openEvent();
    const badgeA = await addBadge(eventA, 50);
    const badgeB = await addBadge(eventB, 50);

    const results = await Promise.all([
      redeemBadge(signQrToken({ kind: "badge", subjectId: badgeA }), levelUserId),
      redeemBadge(signQrToken({ kind: "badge", subjectId: badgeB }), levelUserId),
    ]);

    expect(results.every((result) => result.ok && result.outcome === "granted")).toBe(true);
    expect(results.filter((result) => result.ok && result.levelUpTo !== null).map((result) => result.ok && result.levelUpTo)).toEqual([2]);
  });

  it("rechaza un QR vencido sin escribir", async () => {
    const eventId = await openEvent();
    const badgeId = await addBadge(eventId);
    await checkIn(eventId);
    const token = signQrToken({ kind: "badge", subjectId: badgeId }, shift(-(QR_GRACE_WINDOWS + 2)));

    await expect(redeemBadge(token, userId)).resolves.toEqual({ ok: false, reason: "expired" });
    await expect(db.select().from(badgeRedemption).where(eq(badgeRedemption.badgeId, badgeId))).resolves.toHaveLength(0);
  });
});
