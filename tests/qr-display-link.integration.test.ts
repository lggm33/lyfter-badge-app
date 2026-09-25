import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const headersMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn((path: string): never => { throw new Error(`REDIRECT:${path}`); }));
const cookieStore = vi.hoisted(() => new Map<string, string>());
const cookieJar = vi.hoisted(() => ({
  get: (name: string) => (cookieStore.has(name) ? { name, value: cookieStore.get(name)! } : undefined),
  set: vi.fn((name: string, value: string, options?: Record<string, unknown>) => { cookieStore.set(name, value); void options; }),
}));
const cookiesMock = vi.hoisted(() => vi.fn(async () => cookieJar));
vi.mock("next/headers", () => ({ headers: headersMock, cookies: cookiesMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

vi.stubEnv("QR_SECRET", "test-qr-secret");
if (!process.env.BETTER_AUTH_URL) vi.stubEnv("BETTER_AUTH_URL", "http://localhost:3000");

import { createQrDisplayLink, listQrDisplays, revokeQrDisplay } from "@/app/(protected)/company/[companyId]/actions";
import { claimQrDisplay, getPairedDisplay } from "@/app/display/actions";
import { DISPLAY_COOKIE, hashDisplayToken } from "@/app/lib/qr-display";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { badge, company, companyMember, event, qrDisplay } from "@/db/schema";
import { postAuth, requireTestEnv, cookieHeader, uniqueEmail } from "./helpers";

const CLAIM_ERROR = "Este link ya no es válido. Pedile uno nuevo al administrador.";

const companyId = randomUUID();
const otherCompanyId = randomUUID();
const userEmail = uniqueEmail("qr-display-link");
const otherUserEmail = uniqueEmail("qr-display-link-other");
const password = "integration-test-password";
let cookie: string;
let otherCookie: string;
let userId: string;
let otherUserId: string;

let eventId: string;
let draftEventId: string;
let badgeId: string;

function formData(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [key, value] of Object.entries(fields)) fd.set(key, value);
  return fd;
}

function tokenFromClaimUrl(url: string) {
  return url.split("/display/claim/")[1] ?? "";
}

async function createLink(fields: Record<string, string> = {}) {
  headersMock.mockResolvedValueOnce(new Headers({ cookie }));
  const state = await createQrDisplayLink(null, formData({ companyId, eventId, ...fields }));
  if (!state || "error" in state) throw new Error(`expected a link, got ${JSON.stringify(state)}`);
  return state;
}

async function displayIdForToken(token: string) {
  const [row] = await db.select({ id: qrDisplay.id }).from(qrDisplay).where(eq(qrDisplay.linkTokenHash, hashDisplayToken(token)));
  if (!row) throw new Error("expected a qr_display row for that token");
  return row.id;
}

describe("qr-display link integration", () => {
  beforeAll(async () => {
    requireTestEnv();
    const signUp = await postAuth("/sign-up/email", { name: "QR Link Admin", email: userEmail, password });
    expect(signUp.status).toBe(200);
    userId = (await signUp.json()).user.id;
    const signIn = await postAuth("/sign-in/email", { email: userEmail, password });
    cookie = cookieHeader(signIn);

    const otherSignUp = await postAuth("/sign-up/email", { name: "QR Link Other", email: otherUserEmail, password });
    expect(otherSignUp.status).toBe(200);
    otherUserId = (await otherSignUp.json()).user.id;
    const otherSignIn = await postAuth("/sign-in/email", { email: otherUserEmail, password });
    otherCookie = cookieHeader(otherSignIn);

    await db.insert(company).values([
      { id: companyId, name: "QR Link Co", slug: `qr-link-${companyId}` },
      { id: otherCompanyId, name: "QR Link Other Co", slug: `qr-link-other-${otherCompanyId}` },
    ]);
    await db.insert(companyMember).values([
      { id: randomUUID(), companyId, userId, role: "COMPANY_ADMIN" },
      { id: randomUUID(), companyId: otherCompanyId, userId: otherUserId, role: "COMPANY_ADMIN" },
    ]);

    eventId = randomUUID();
    await db.insert(event).values({
      id: eventId,
      companyId,
      name: "Active Link Event",
      slug: "active-link-event",
      startsAt: new Date(Date.now() - 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      status: "ACTIVE",
    });

    draftEventId = randomUUID();
    await db.insert(event).values({
      id: draftEventId,
      companyId,
      name: "Draft Link Event",
      slug: "draft-link-event",
      startsAt: new Date(Date.now() + 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
    });

    badgeId = randomUUID();
    await db.insert(badge).values({ id: badgeId, eventId, name: "Link Badge", type: "CONTENT", rarity: "COMMON", xp: 50 });
  });

  afterAll(async () => {
    await db.delete(company).where(eq(company.id, companyId));
    await db.delete(company).where(eq(company.id, otherCompanyId));
    await db.delete(user).where(eq(user.email, userEmail));
    await db.delete(user).where(eq(user.email, otherUserEmail));
  });

  it("creates a screen link without persisting the raw token", async () => {
    const state = await createLink({ badge: badgeId });

    expect(state.url).toBe(`${process.env.BETTER_AUTH_URL}/display/claim/${tokenFromClaimUrl(state.url)}`);
    const token = tokenFromClaimUrl(state.url);
    expect(token.length).toBeGreaterThan(0);

    const [row] = await db.select().from(qrDisplay).where(eq(qrDisplay.linkTokenHash, hashDisplayToken(token)));
    expect(row).toBeTruthy();
    expect(row.linkTokenHash).not.toBe(token);
    expect(row.linkTokenHash).toBe(hashDisplayToken(token));
    expect(row.badgeId).toBe(badgeId);
    expect(row.claimedAt).toBeNull();
    expect(row.deviceTokenHash).toBeNull();
  });

  it("rejects creating a screen link for a draft event", async () => {
    headersMock.mockResolvedValueOnce(new Headers({ cookie }));
    const state = await createQrDisplayLink(null, formData({ companyId, eventId: draftEventId }));
    expect(state).toEqual({ error: "Solo se pueden crear pantallas para eventos activos." });
  });

  it("rejects creating a screen link with a badge from another event", async () => {
    headersMock.mockResolvedValueOnce(new Headers({ cookie }));
    const state = await createQrDisplayLink(null, formData({ companyId, eventId, badge: randomUUID() }));
    expect(state).toEqual({ error: "El badge no existe." });
  });

  it("a different company's admin gets redirected home on create and revoke", async () => {
    headersMock.mockResolvedValueOnce(new Headers({ cookie: otherCookie }));
    await expect(createQrDisplayLink(null, formData({ companyId, eventId }))).rejects.toThrow("REDIRECT:/home");

    headersMock.mockResolvedValueOnce(new Headers({ cookie: otherCookie }));
    await expect(revokeQrDisplay(formData({ companyId, eventId, displayId: randomUUID() }))).rejects.toThrow("REDIRECT:/home");
  });

  it("claims a link once, cookies a fresh device token, and lets the paired screen see the active QR", async () => {
    const { url } = await createLink();
    const linkToken = tokenFromClaimUrl(url);

    await expect(claimQrDisplay(null, formData({ token: linkToken }))).rejects.toThrow("REDIRECT:/display");

    expect(cookieJar.set).toHaveBeenCalled();
    const [name, deviceToken, options] = cookieJar.set.mock.calls.at(-1)!;
    expect(name).toBe(DISPLAY_COOKIE);
    expect(deviceToken).not.toBe(linkToken);
    expect(options).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/display" });
    expect(options?.expires).toBeInstanceOf(Date);

    const [row] = await db.select().from(qrDisplay).where(eq(qrDisplay.linkTokenHash, hashDisplayToken(linkToken)));
    expect(row.claimedAt).not.toBeNull();
    expect(row.deviceTokenHash).toBe(hashDisplayToken(deviceToken));

    const display = await getPairedDisplay();
    expect(display).toMatchObject({ status: "active", kind: "checkin", eventName: "Active Link Event" });
  });

  it("gives the same generic error for a second claim, a revoked link, and an expired link", async () => {
    const second = await createLink();
    const secondToken = tokenFromClaimUrl(second.url);
    await expect(claimQrDisplay(null, formData({ token: secondToken }))).rejects.toThrow("REDIRECT:/display");
    await expect(claimQrDisplay(null, formData({ token: secondToken }))).resolves.toEqual({ error: CLAIM_ERROR });

    const revoked = await createLink();
    const revokedToken = tokenFromClaimUrl(revoked.url);
    const revokedDisplayId = await displayIdForToken(revokedToken);
    headersMock.mockResolvedValueOnce(new Headers({ cookie }));
    await expect(revokeQrDisplay(formData({ companyId, eventId, displayId: revokedDisplayId }))).rejects.toThrow(`REDIRECT:/company/${companyId}/events/${eventId}/qr`);
    await expect(claimQrDisplay(null, formData({ token: revokedToken }))).resolves.toEqual({ error: CLAIM_ERROR });

    const expired = await createLink();
    const expiredToken = tokenFromClaimUrl(expired.url);
    await db.update(qrDisplay).set({ expiresAt: new Date(Date.now() - 60 * 1000) }).where(eq(qrDisplay.linkTokenHash, hashDisplayToken(expiredToken)));
    await expect(claimQrDisplay(null, formData({ token: expiredToken }))).resolves.toEqual({ error: CLAIM_ERROR });

    await expect(claimQrDisplay(null, formData({ token: "" }))).resolves.toEqual({ error: CLAIM_ERROR });
  });

  it("stops showing the QR once the paired screen is revoked", async () => {
    const { url } = await createLink();
    const linkToken = tokenFromClaimUrl(url);
    await expect(claimQrDisplay(null, formData({ token: linkToken }))).rejects.toThrow("REDIRECT:/display");
    await expect(getPairedDisplay()).resolves.toMatchObject({ status: "active" });

    const displayId = await displayIdForToken(linkToken);
    headersMock.mockResolvedValueOnce(new Headers({ cookie }));
    await expect(revokeQrDisplay(formData({ companyId, eventId, displayId }))).rejects.toThrow(`REDIRECT:/company/${companyId}/events/${eventId}/qr`);

    await expect(getPairedDisplay()).resolves.toBeNull();
  });

  it("lists pending, paired, and revoked screens for a badge", async () => {
    const listBadgeId = randomUUID();
    await db.insert(badge).values({ id: listBadgeId, eventId, name: "List Badge", type: "CONTENT", rarity: "COMMON", xp: 50 });

    await createLink({ badge: listBadgeId });
    const paired = await createLink({ badge: listBadgeId });
    await expect(claimQrDisplay(null, formData({ token: tokenFromClaimUrl(paired.url) }))).rejects.toThrow("REDIRECT:/display");

    const revoked = await createLink({ badge: listBadgeId });
    const revokedDisplayId = await displayIdForToken(tokenFromClaimUrl(revoked.url));
    headersMock.mockResolvedValueOnce(new Headers({ cookie }));
    await expect(revokeQrDisplay(formData({ companyId, eventId, displayId: revokedDisplayId, badge: listBadgeId }))).rejects.toThrow(`REDIRECT:/company/${companyId}/events/${eventId}/qr?badge=${listBadgeId}`);

    headersMock.mockResolvedValueOnce(new Headers({ cookie }));
    const rows = await listQrDisplays(companyId, eventId, listBadgeId);
    expect(rows).toHaveLength(3);

    const statuses = rows.map((row) => row.status);
    expect(statuses).toContain("pending");
    expect(statuses).toContain("paired");
    expect(statuses).toContain("revoked");
  });
});
