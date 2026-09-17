import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const headersMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn((path: string): never => { throw new Error(`REDIRECT:${path}`); }));
vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { activateEvent, createEvent, listMyCompanyEvents } from "@/app/(protected)/company/[companyId]/actions";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { company, companyMember, event } from "@/db/schema";
import { postAuth, requireTestEnv, cookieHeader, uniqueEmail } from "./helpers";

const companyId = randomUUID();
const userEmail = uniqueEmail("events-admin");
const password = "integration-test-password";
let cookie: string;
let userId: string;

function form(values: Record<string, string>) {
  const result = new FormData();
  Object.entries(values).forEach(([key, value]) => result.set(key, value));
  return result;
}

describe("event actions integration", () => {
  beforeAll(async () => {
    requireTestEnv();
    const signUp = await postAuth("/sign-up/email", { name: "Events Admin", email: userEmail, password });
    expect(signUp.status).toBe(200);
    userId = (await signUp.json()).user.id;
    const signIn = await postAuth("/sign-in/email", { email: userEmail, password });
    cookie = cookieHeader(signIn);
    await db.insert(company).values({ id: companyId, name: "Events Co", slug: `events-${companyId}` });
    await db.insert(companyMember).values({ id: randomUUID(), companyId, userId, role: "COMPANY_ADMIN" });
  });

  afterAll(async () => {
    await db.delete(company).where(eq(company.id, companyId));
    await db.delete(user).where(eq(user.email, userEmail));
  });

  it("creates and lists an event for a company member", async () => {
    headersMock.mockResolvedValueOnce(new Headers({ cookie }));
    await expect(createEvent(form({ companyId, name: "Demo", slug: "demo", startsAt: "2026-10-01T10:00", endsAt: "2026-10-01T18:00" }))).rejects.toThrow(`REDIRECT:/company/${companyId}`);
    headersMock.mockResolvedValueOnce(new Headers({ cookie }));
    await expect(listMyCompanyEvents(companyId)).resolves.toMatchObject([{ name: "Demo", status: "DRAFT" }]);
  });

  it("rejects invalid date ranges and duplicate slugs", async () => {
    headersMock.mockResolvedValueOnce(new Headers({ cookie }));
    await expect(createEvent(form({ companyId, name: "Invalid", slug: "invalid", startsAt: "2026-10-02T18:00", endsAt: "2026-10-02T10:00" }))).rejects.toThrow("Las fechas del evento no son válidas.");
    headersMock.mockResolvedValueOnce(new Headers({ cookie }));
    await expect(createEvent(form({ companyId, name: "Duplicate", slug: "demo", startsAt: "2026-10-01T10:00", endsAt: "2026-10-01T18:00" }))).rejects.toThrow("Ya existe un evento con ese slug");
  });

  it("only activates during the 24 hours before the event", async () => {
    headersMock.mockResolvedValueOnce(new Headers({ cookie }));
    await expect(activateEvent(form({ companyId, eventId: randomUUID() }))).rejects.toThrow("El evento no existe.");
    const eventId = randomUUID();
    await db.insert(event).values({ id: eventId, companyId, name: "Soon", slug: "soon", startsAt: new Date(Date.now() + 60 * 60 * 1000), endsAt: new Date(Date.now() + 2 * 60 * 60 * 1000) });
    headersMock.mockResolvedValueOnce(new Headers({ cookie }));
    await expect(activateEvent(form({ companyId, eventId }))).rejects.toThrow(`REDIRECT:/company/${companyId}`);
    await expect(db.select({ status: event.status }).from(event).where(eq(event.id, eventId))).resolves.toMatchObject([{ status: "ACTIVE" }]);
  });
});
