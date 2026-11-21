import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray } from "drizzle-orm";

const headersMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn((path: string): never => {
  throw new Error(`REDIRECT:${path}`);
}));

vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

import AdminAuditPage from "@/app/(protected)/admin/audit/page";
import { assignCompanyAdmin, createCompany, removeCompanyMember } from "@/app/(protected)/admin/companies/actions";
import CompanyAuditPage from "@/app/(protected)/company/[companyId]/audit/page";
import { createEvent, deleteEvent } from "@/app/(protected)/company/[companyId]/actions";
import { AUDIT_PAGE_SIZE, listCompanyAudit, recordAudit } from "@/app/lib/audit";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { auditLog, company, companyMember, event } from "@/db/schema";
import { seedSuperAdmin } from "@/db/seed";
import { cookieHeader, postAuth, requireTestEnv, uniqueEmail } from "./helpers";

const password = "integration-test-password";
const adminEmail = uniqueEmail("audit-admin");
const memberEmail = uniqueEmail("audit-member");
const participantEmail = uniqueEmail("audit-participant");
const companySlug = `audit-${randomUUID()}`;
const otherCompanyId = randomUUID();
const ownedCompanyId = randomUUID();

let adminId: string;
let adminCookie: string;
let memberId: string;
let memberCookie: string;
let participantCookie: string;
let createdCompanyId: string;

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

async function signIn(email: string) {
  const response = await postAuth("/sign-in/email", { email, password });
  expect(response.status).toBe(200);
  return cookieHeader(response);
}

describe("audit log", () => {
  beforeAll(async () => {
    requireTestEnv();
    const seeded = await seedSuperAdmin({ email: adminEmail, password, name: "Audit Super" });
    adminId = seeded.id;
    adminCookie = await signIn(adminEmail);

    const memberSignUp = await postAuth("/sign-up/email", { name: "Audit Member", email: memberEmail, password });
    expect(memberSignUp.status).toBe(200);
    memberId = (await memberSignUp.json()).user.id;
    memberCookie = await signIn(memberEmail);

    const participantSignUp = await postAuth("/sign-up/email", { name: "Audit Participant", email: participantEmail, password });
    expect(participantSignUp.status).toBe(200);
    participantCookie = await signIn(participantEmail);

    await db.insert(company).values([
      { id: otherCompanyId, name: "Audit Other Co", slug: `other-${otherCompanyId}` },
      { id: ownedCompanyId, name: "Audit Owned Co", slug: `owned-${ownedCompanyId}` },
    ]);
    await db.insert(companyMember).values({ id: randomUUID(), companyId: ownedCompanyId, userId: memberId, role: "COMPANY_ADMIN" });
  });

  afterAll(async () => {
    const companyIds = [otherCompanyId, ownedCompanyId, createdCompanyId].filter(Boolean);
    await db.delete(auditLog).where(inArray(auditLog.actorId, [adminId, memberId]));
    await db.delete(company).where(inArray(company.id, companyIds));
    await db.delete(user).where(inArray(user.email, [adminEmail, memberEmail, participantEmail]));
  });

  it("records the actor when a company is created and skips a duplicate slug", async () => {
    withCookie(adminCookie);
    await expect(createCompany(form({ name: "Audit Co", slug: companySlug }))).rejects.toThrow("REDIRECT:/admin/companies");

    const [created] = await db.select({ id: company.id }).from(company).where(eq(company.slug, companySlug));
    createdCompanyId = created.id;

    withCookie(adminCookie);
    await expect(createCompany(form({ name: "Audit Co", slug: companySlug }))).rejects.toThrow("Ya existe una empresa con ese slug.");

    const rows = await db.select().from(auditLog).where(eq(auditLog.companyId, createdCompanyId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      actorId: adminId,
      actorName: "Audit Super",
      action: "company.created",
      companyName: "Audit Co",
      resourceType: "company",
      resourceId: createdCompanyId,
      metadata: { slug: companySlug },
    });
  });

  it("records an admin assignment once", async () => {
    withCookie(adminCookie);
    await expect(assignCompanyAdmin(form({ companyId: createdCompanyId, userId: memberId }))).rejects.toThrow(`REDIRECT:/admin/companies/${createdCompanyId}`);
    withCookie(adminCookie);
    await expect(assignCompanyAdmin(form({ companyId: createdCompanyId, userId: memberId }))).rejects.toThrow(`REDIRECT:/admin/companies/${createdCompanyId}`);

    const rows = await db.select().from(auditLog).where(and(eq(auditLog.companyId, createdCompanyId), eq(auditLog.action, "company_admin.assigned")));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.metadata).toMatchObject({ userId: memberId, userName: "Audit Member" });
  });

  it("does not remove or record a member from another company", async () => {
    const memberRowId = randomUUID();
    await db.insert(companyMember).values({ id: memberRowId, companyId: otherCompanyId, userId: memberId, role: "COMPANY_ADMIN" });

    withCookie(adminCookie);
    await expect(removeCompanyMember(form({ companyId: ownedCompanyId, memberId: memberRowId }))).rejects.toThrow(`REDIRECT:/admin/companies/${ownedCompanyId}`);

    await expect(db.select({ id: companyMember.id }).from(companyMember).where(eq(companyMember.id, memberRowId))).resolves.toHaveLength(1);
    const rows = await db.select().from(auditLog).where(eq(auditLog.resourceId, memberRowId));
    expect(rows).toHaveLength(0);
  });

  it("does not record an event when validation fails", async () => {
    withCookie(memberCookie);
    await expect(createEvent(form({
      companyId: ownedCompanyId,
      name: "Past",
      slug: "past-audit",
      startsAt: "2020-01-01T10:00",
      endsAt: "2020-01-01T18:00",
    }))).resolves.toMatchObject({ error: "El evento no puede comenzar en el pasado." });

    const rows = await db.select().from(auditLog).where(and(eq(auditLog.companyId, ownedCompanyId), eq(auditLog.action, "event.created")));
    expect(rows).toHaveLength(0);
  });

  it("keeps the event name after the event is deleted", async () => {
    withCookie(memberCookie);
    await expect(createEvent(form({
      companyId: ownedCompanyId,
      name: "Audit Day",
      slug: "audit-day",
      modality: "IN_PERSON",
      startsAt: hoursFromNow(48),
      endsAt: hoursFromNow(56),
    }))).rejects.toThrow(`REDIRECT:/company/${ownedCompanyId}`);

    const [createdEvent] = await db.select({ id: event.id }).from(event).where(and(eq(event.companyId, ownedCompanyId), eq(event.slug, "audit-day")));
    withCookie(memberCookie);
    await expect(deleteEvent(form({ companyId: ownedCompanyId, eventId: createdEvent.id }))).rejects.toThrow(`REDIRECT:/company/${ownedCompanyId}`);

    const [deleted] = await db.select().from(auditLog).where(and(eq(auditLog.action, "event.deleted"), eq(auditLog.resourceId, createdEvent.id)));
    expect(deleted.eventId).toBeNull();
    expect(deleted.eventName).toBe("Audit Day");
    expect(deleted.companyId).toBe(ownedCompanyId);
    await expect(db.select().from(event).where(eq(event.id, createdEvent.id))).resolves.toHaveLength(0);
  });

  it("hides another company's rows and ignores a foreign event filter", async () => {
    const foreignEventId = randomUUID();
    await db.insert(event).values({
      id: foreignEventId,
      companyId: otherCompanyId,
      name: "Foreign",
      slug: "foreign",
      startsAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
      endsAt: new Date(Date.now() + 56 * 60 * 60 * 1000),
    });
    await db.transaction(async (tx) => {
      await recordAudit(tx, {
        actorId: adminId,
        actorName: "Audit Super",
        action: "event.created",
        companyId: otherCompanyId,
        eventId: foreignEventId,
        resourceType: "event",
        resourceId: foreignEventId,
        metadata: { slug: "foreign" },
      });
    });

    const own = await listCompanyAudit(ownedCompanyId, { eventId: foreignEventId, actorQuery: "", action: null, page: 1 });
    expect(own.rows.every((row) => row.companyName === "Audit Owned Co")).toBe(true);
    expect(own.rows.some((row) => row.eventName === "Audit Day")).toBe(true);
    expect(own.eventId).toBeNull();

    const foreign = await listCompanyAudit(otherCompanyId, { eventId: null, actorQuery: "", action: null, page: 1 });
    expect(foreign.rows.some((row) => row.eventName === "Foreign")).toBe(true);
    expect(foreign.rows.some((row) => row.eventName === "Audit Day")).toBe(false);
  });

  it("filters by actor only from two characters and pages the company log", async () => {
    await db.transaction(async (tx) => {
      for (let index = 0; index < AUDIT_PAGE_SIZE; index += 1) {
        await recordAudit(tx, {
          actorId: memberId,
          actorName: "Audit Member",
          action: "badge.created",
          companyId: ownedCompanyId,
          resourceType: "badge",
          resourceId: randomUUID(),
          metadata: { name: `Badge ${index}` },
        });
      }
    });

    const byEmail = await listCompanyAudit(ownedCompanyId, { eventId: null, actorQuery: memberEmail.slice(0, 12), action: "badge.created", page: 1 });
    expect(byEmail.rows.length).toBeGreaterThan(0);
    expect(byEmail.rows.every((row) => row.action === "badge.created")).toBe(true);
    expect(byEmail.actorTooShort).toBe(false);

    const tooShort = await listCompanyAudit(ownedCompanyId, { eventId: null, actorQuery: "a", action: null, page: 1 });
    expect(tooShort.actorTooShort).toBe(true);
    expect(tooShort.rows.length).toBeGreaterThan(1);

    const firstPage = await listCompanyAudit(ownedCompanyId, { eventId: null, actorQuery: "", action: null, page: 1 });
    const secondPage = await listCompanyAudit(ownedCompanyId, { eventId: null, actorQuery: "", action: null, page: 2 });
    expect(firstPage.rows).toHaveLength(AUDIT_PAGE_SIZE);
    expect(firstPage.hasNextPage).toBe(true);
    expect(secondPage.rows.length).toBeGreaterThan(0);
    const seen = new Set([...firstPage.rows, ...secondPage.rows].map((row) => row.id));
    expect(seen.size).toBe(firstPage.rows.length + secondPage.rows.length);
  });

  it("redirects a participant away from both audit pages", async () => {
    withCookie(participantCookie);
    await expect(AdminAuditPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/home");

    withCookie(participantCookie);
    await expect(CompanyAuditPage({
      params: Promise.resolve({ companyId: ownedCompanyId }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("REDIRECT:/home");
  });
});
