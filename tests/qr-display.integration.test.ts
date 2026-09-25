import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const headersMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn((path: string): never => { throw new Error(`REDIRECT:${path}`); }));
vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

vi.stubEnv("QR_SECRET", "test-qr-secret");
if (!process.env.BETTER_AUTH_URL) vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");

import { getQrDisplay } from "@/app/(protected)/company/[companyId]/actions";
import { verifyQrToken } from "@/app/lib/qr-token";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { badge, company, companyMember, event } from "@/db/schema";
import { postAuth, requireTestEnv, cookieHeader, uniqueEmail } from "./helpers";

const companyId = randomUUID();
const otherCompanyId = randomUUID();
const userEmail = uniqueEmail("qr-display");
const otherUserEmail = uniqueEmail("qr-display-other");
const password = "integration-test-password";
let cookie: string;
let otherCookie: string;
let userId: string;
let otherUserId: string;

function parseToken(url: string) {
  return new URL(url).searchParams.get("t") ?? "";
}

describe("getQrDisplay integration", () => {
  beforeAll(async () => {
    requireTestEnv();
    const signUp = await postAuth("/sign-up/email", { name: "QR Display Admin", email: userEmail, password });
    expect(signUp.status).toBe(200);
    userId = (await signUp.json()).user.id;
    const signIn = await postAuth("/sign-in/email", { email: userEmail, password });
    cookie = cookieHeader(signIn);

    const otherSignUp = await postAuth("/sign-up/email", { name: "QR Display Other", email: otherUserEmail, password });
    expect(otherSignUp.status).toBe(200);
    otherUserId = (await otherSignUp.json()).user.id;
    const otherSignIn = await postAuth("/sign-in/email", { email: otherUserEmail, password });
    otherCookie = cookieHeader(otherSignIn);

    await db.insert(company).values([
      { id: companyId, name: "QR Display Co", slug: `qr-display-${companyId}` },
      { id: otherCompanyId, name: "QR Display Other Co", slug: `qr-display-other-${otherCompanyId}` },
    ]);
    await db.insert(companyMember).values([
      { id: randomUUID(), companyId, userId, role: "COMPANY_ADMIN" },
      { id: randomUUID(), companyId: otherCompanyId, userId: otherUserId, role: "COMPANY_ADMIN" },
    ]);
  });

  afterAll(async () => {
    await db.delete(company).where(eq(company.id, companyId));
    await db.delete(company).where(eq(company.id, otherCompanyId));
    await db.delete(user).where(eq(user.email, userEmail));
    await db.delete(user).where(eq(user.email, otherUserEmail));
  });

  it("returns an active check-in QR for an active event without a badge", async () => {
    const eventId = randomUUID();
    await db.insert(event).values({
      id: eventId,
      companyId,
      name: "Active Checkin",
      slug: "active-checkin",
      startsAt: new Date(Date.now() - 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
      status: "ACTIVE",
    });

    headersMock.mockResolvedValueOnce(new Headers({ cookie }));
    const display = await getQrDisplay(companyId, eventId);

    expect(display).toMatchObject({ status: "active", kind: "checkin", eventName: "Active Checkin" });
    if (display?.status !== "active") throw new Error("expected active display");
    const token = parseToken(display.url);
    expect(verifyQrToken(token)).toEqual({ ok: true, kind: "checkin", subjectId: eventId });
  });

  it("returns an active badge QR for an active event with a badge", async () => {
    const eventId = randomUUID();
    await db.insert(event).values({
      id: eventId,
      companyId,
      name: "Active Badge Event",
      slug: "active-badge-event",
      startsAt: new Date(Date.now() - 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
      status: "ACTIVE",
    });
    const badgeId = randomUUID();
    await db.insert(badge).values({ id: badgeId, eventId, name: "Welcome Badge", type: "CONTENT", rarity: "COMMON", xp: 50 });

    headersMock.mockResolvedValueOnce(new Headers({ cookie }));
    const display = await getQrDisplay(companyId, eventId, badgeId);

    expect(display).toMatchObject({ status: "active", kind: "badge" });
    if (display?.status !== "active") throw new Error("expected active display");
    expect(display.title).toContain("Welcome Badge");
    const token = parseToken(display.url);
    expect(verifyQrToken(token)).toEqual({ ok: true, kind: "badge", subjectId: badgeId });
  });

  it("returns inactive status for a draft event", async () => {
    const eventId = randomUUID();
    await db.insert(event).values({
      id: eventId,
      companyId,
      name: "Draft Event",
      slug: "draft-event",
      startsAt: new Date(Date.now() + 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    headersMock.mockResolvedValueOnce(new Headers({ cookie }));
    await expect(getQrDisplay(companyId, eventId)).resolves.toMatchObject({ status: "inactive", eventStatus: "DRAFT" });
  });

  it("returns inactive status for an active event that has already ended", async () => {
    const eventId = randomUUID();
    await db.insert(event).values({
      id: eventId,
      companyId,
      name: "Ended Event",
      slug: "ended-event",
      startsAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() - 60 * 60 * 1000),
      status: "ACTIVE",
    });

    headersMock.mockResolvedValueOnce(new Headers({ cookie }));
    await expect(getQrDisplay(companyId, eventId)).resolves.toMatchObject({ status: "inactive", eventStatus: "ACTIVE" });
  });

  it("returns null when the badge belongs to a different event", async () => {
    const eventId = randomUUID();
    const otherEventId = randomUUID();
    await db.insert(event).values([
      {
        id: eventId,
        companyId,
        name: "Badge Owner Event",
        slug: "badge-owner-event",
        startsAt: new Date(Date.now() - 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
        status: "ACTIVE",
      },
      {
        id: otherEventId,
        companyId,
        name: "Badge Foreign Event",
        slug: "badge-foreign-event",
        startsAt: new Date(Date.now() - 60 * 60 * 1000),
        endsAt: new Date(Date.now() + 60 * 60 * 1000),
        status: "ACTIVE",
      },
    ]);
    const badgeId = randomUUID();
    await db.insert(badge).values({ id: badgeId, eventId: otherEventId, name: "Foreign Badge", type: "CONTENT", rarity: "COMMON", xp: 50 });

    headersMock.mockResolvedValueOnce(new Headers({ cookie }));
    await expect(getQrDisplay(companyId, eventId, badgeId)).resolves.toBeNull();
  });

  it("rejects a user who is a member of a different company", async () => {
    const eventId = randomUUID();
    await db.insert(event).values({
      id: eventId,
      companyId,
      name: "Foreign Access Event",
      slug: "foreign-access-event",
      startsAt: new Date(Date.now() - 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
      status: "ACTIVE",
    });

    headersMock.mockResolvedValueOnce(new Headers({ cookie: otherCookie }));
    await expect(getQrDisplay(companyId, eventId)).rejects.toThrow("REDIRECT:/home");
  });
});
