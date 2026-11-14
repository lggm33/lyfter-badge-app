import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";

const { headersMock, cookieJar } = vi.hoisted(() => {
  const cookieJar = new Map<string, { value: string }>();
  return {
    cookieJar,
    headersMock: vi.fn(),
  };
});
const redirectMock = vi.hoisted(() => vi.fn((path: string): never => {
  throw new Error(`REDIRECT:${path}`);
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
  cookies: async () => ({
    get(name: string) {
      return cookieJar.get(name);
    },
    set(name: string, value: string) {
      cookieJar.set(name, { value });
    },
    delete(name: string) {
      cookieJar.delete(name);
    },
  }),
}));
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

import { createEvent } from "@/app/(protected)/company/[companyId]/actions";
import { requireCompanyMembership } from "@/app/lib/authz";
import { IMPERSONATION_COOKIE, signImpersonation, verifyImpersonation } from "@/app/lib/impersonation";
import { startImpersonation, stopImpersonation } from "@/app/lib/impersonation-actions";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { auditLog, company, companyMember } from "@/db/schema";
import { seedSuperAdmin } from "@/db/seed";
import { cookieHeader, postAuth, requireTestEnv, uniqueEmail } from "./helpers";

const password = "integration-test-password";
const adminEmail = uniqueEmail("impersonation-admin");
const participantEmail = uniqueEmail("impersonation-participant");
const targetCompanyId = randomUUID();
const memberCompanyId = randomUUID();

let adminId = "";
let adminCookie = "";
let participantId = "";
let participantCookie = "";

function withCookie(cookie?: string) {
  headersMock.mockResolvedValueOnce(new Headers(cookie ? { cookie } : undefined));
}

function form(values: Record<string, string>) {
  const result = new FormData();
  Object.entries(values).forEach(([key, value]) => result.set(key, value));
  return result;
}

function hoursFromNow(hours: number) {
  const date = new Date(Date.now() + hours * 60 * 60 * 1000);
  const parts = [date.getFullYear(), date.getMonth() + 1, date.getDate(), date.getHours(), date.getMinutes()]
    .map((value) => String(value).padStart(2, "0"));
  return `${parts[0]}-${parts[1]}-${parts[2]}T${parts[3]}:${parts[4]}`;
}

describe("impersonation token", () => {
  it("rejects a tampered or expired token", () => {
    const secret = "test-secret";
    const token = signImpersonation({ companyId: "company", actorId: "actor", exp: 1_800_000_000_000 }, secret);
    expect(verifyImpersonation(token, secret, 1_700_000_000_000)).toEqual({
      companyId: "company",
      actorId: "actor",
      exp: 1_800_000_000_000,
    });
    expect(verifyImpersonation(token, secret, 1_800_000_000_000)).toBeNull();
    const flipped = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    expect(verifyImpersonation(flipped, secret, 1_700_000_000_000)).toBeNull();
    expect(verifyImpersonation(token, "other-secret", 1_700_000_000_000)).toBeNull();
  });
});

describe("impersonation", () => {
  beforeAll(async () => {
    requireTestEnv();
    const seeded = await seedSuperAdmin({ email: adminEmail, password, name: "Impersonation Super" });
    adminId = seeded.id;
    adminCookie = cookieHeader(await postAuth("/sign-in/email", { email: adminEmail, password }));
    const participantSignUp = await postAuth("/sign-up/email", { name: "Impersonation Participant", email: participantEmail, password });
    expect(participantSignUp.status).toBe(200);
    participantId = (await participantSignUp.json()).user.id;
    participantCookie = cookieHeader(await postAuth("/sign-in/email", { email: participantEmail, password }));

    await db.insert(company).values([
      { id: targetCompanyId, name: "Impersonation Target", slug: `impersonation-${targetCompanyId}` },
      { id: memberCompanyId, name: "Impersonation Member", slug: `impersonation-member-${memberCompanyId}` },
    ]);
    await db.insert(companyMember).values({ id: randomUUID(), companyId: memberCompanyId, userId: adminId, role: "COMPANY_ADMIN" });
  });

  beforeEach(() => {
    cookieJar.clear();
  });

  afterAll(async () => {
    await db.delete(auditLog).where(eq(auditLog.actorId, adminId));
    await db.delete(company).where(inArray(company.id, [targetCompanyId, memberCompanyId]));
    await db.delete(user).where(inArray(user.email, [adminEmail, participantEmail]));
  });

  it("does not open a company for a participant, even with a signed cookie", async () => {
    const secret = process.env.BETTER_AUTH_SECRET ?? "";
    const token = signImpersonation({ companyId: targetCompanyId, actorId: participantId, exp: Date.now() + 60_000 }, secret);
    cookieJar.set(IMPERSONATION_COOKIE, { value: token });
    withCookie(participantCookie);
    await expect(requireCompanyMembership(targetCompanyId)).rejects.toThrow("REDIRECT:/home");

    const flipped = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
    cookieJar.set(IMPERSONATION_COOKIE, { value: flipped });
    withCookie(adminCookie);
    await expect(requireCompanyMembership(targetCompanyId)).rejects.toThrow("REDIRECT:/home");
  });

  it("skips the cookie when the super admin is already a member", async () => {
    withCookie(adminCookie);
    await expect(startImpersonation(form({ companyId: memberCompanyId }))).rejects.toThrow(`REDIRECT:/company/${memberCompanyId}`);
    expect(cookieJar.has(IMPERSONATION_COOKIE)).toBe(false);
    const rows = await db.select({ id: auditLog.id }).from(auditLog).where(and(
      eq(auditLog.action, "impersonation.started"),
      eq(auditLog.companyId, memberCompanyId),
    ));
    expect(rows).toEqual([]);
  });

  it("enters and leaves without a membership, and stamps the mutation", async () => {
    withCookie(adminCookie);
    await expect(startImpersonation(form({ companyId: targetCompanyId }))).rejects.toThrow(`REDIRECT:/company/${targetCompanyId}`);
    expect(cookieJar.get(IMPERSONATION_COOKIE)?.value).toBeTruthy();

    const members = await db
      .select({ id: companyMember.id })
      .from(companyMember)
      .where(and(eq(companyMember.companyId, targetCompanyId), eq(companyMember.userId, adminId)));
    expect(members).toEqual([]);

    withCookie(adminCookie);
    await expect(createEvent(form({
      companyId: targetCompanyId,
      name: "Evento impersonado",
      slug: "evento-impersonado",
      startsAt: hoursFromNow(48),
      endsAt: hoursFromNow(50),
    }))).rejects.toThrow(`REDIRECT:/company/${targetCompanyId}`);

    const [created] = await db.select({ actorId: auditLog.actorId, metadata: auditLog.metadata }).from(auditLog).where(and(
      eq(auditLog.action, "event.created"),
      eq(auditLog.companyId, targetCompanyId),
    ));
    expect(created).toMatchObject({ actorId: adminId, metadata: { impersonating: true, slug: "evento-impersonado" } });

    withCookie(adminCookie);
    await expect(stopImpersonation()).rejects.toThrow(`REDIRECT:/admin/companies/${targetCompanyId}`);
    expect(cookieJar.has(IMPERSONATION_COOKIE)).toBe(false);

    const actions = await db
      .select({ action: auditLog.action })
      .from(auditLog)
      .where(and(eq(auditLog.actorId, adminId), eq(auditLog.companyId, targetCompanyId), inArray(auditLog.action, ["impersonation.started", "impersonation.stopped"])));
    expect(actions.map((row) => row.action).sort()).toEqual(["impersonation.started", "impersonation.stopped"]);

    withCookie(adminCookie);
    await expect(requireCompanyMembership(targetCompanyId)).rejects.toThrow("REDIRECT:/home");
  });
});
