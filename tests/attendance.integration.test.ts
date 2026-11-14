import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { inArray } from "drizzle-orm";

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

import EventAttendancePage from "@/app/(protected)/company/[companyId]/events/[eventId]/asistencia/page";
import { ATTENDANCE_PAGE_SIZE, getEventAttendance } from "@/app/lib/attendance";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { badge, badgeRedemption, company, companyMember, event, eventCompletion, eventMembership } from "@/db/schema";
import { cookieHeader, postAuth, requireTestEnv, uniqueEmail } from "./helpers";

const password = "integration-test-password";
const adminEmail = uniqueEmail("attendance-admin");
const participantEmail = uniqueEmail("attendance-participant");
const companyId = randomUUID();
const otherCompanyId = randomUUID();
const eventId = randomUUID();
const otherEventId = randomUUID();
const talkId = randomUUID();
const standId = randomUUID();
const otherBadgeId = randomUUID();
const outsiderId = randomUUID();
const outsiderEmail = uniqueEmail("attendance-outsider");

const people = Array.from({ length: ATTENDANCE_PAGE_SIZE + 1 }, (_, index) => ({
  id: randomUUID(),
  name: `Asistente ${String(index).padStart(2, "0")}`,
  email: uniqueEmail(`attendance-${index}`),
  index,
}));

let adminCookie = "";
let participantCookie = "";

function withCookie(cookie?: string) {
  headersMock.mockResolvedValueOnce(new Headers(cookie ? { cookie } : undefined));
}

describe("event attendance", () => {
  beforeAll(async () => {
    requireTestEnv();
    const adminSignUp = await postAuth("/sign-up/email", { name: "Attendance Admin", email: adminEmail, password });
    const participantSignUp = await postAuth("/sign-up/email", { name: "Attendance Participant", email: participantEmail, password });
    expect(adminSignUp.status).toBe(200);
    expect(participantSignUp.status).toBe(200);
    const adminId = (await adminSignUp.json()).user.id;
    adminCookie = cookieHeader(await postAuth("/sign-in/email", { email: adminEmail, password }));
    participantCookie = cookieHeader(await postAuth("/sign-in/email", { email: participantEmail, password }));

    await db.insert(user).values([
      ...people.map((person) => ({ id: person.id, name: person.name, email: person.email })),
      { id: outsiderId, name: "Otra empresa", email: outsiderEmail },
    ]);
    await db.insert(company).values([
      { id: companyId, name: "Attendance Co", slug: `attendance-${companyId}` },
      { id: otherCompanyId, name: "Other Attendance Co", slug: `attendance-other-${otherCompanyId}` },
    ]);
    await db.insert(companyMember).values({ id: randomUUID(), companyId, userId: adminId, role: "COMPANY_ADMIN" });
    await db.insert(event).values([
      { id: eventId, companyId, name: "Attendance Day", slug: "attendance-day", startsAt: new Date("2026-12-01T15:00:00Z"), endsAt: new Date("2026-12-01T20:00:00Z") },
      { id: otherEventId, companyId: otherCompanyId, name: "Other Day", slug: "other-day", startsAt: new Date("2026-12-02T15:00:00Z"), endsAt: new Date("2026-12-02T20:00:00Z") },
    ]);
    await db.insert(badge).values([
      { id: talkId, eventId, name: "Charla", type: "TALK", rarity: "COMMON", xp: 50 },
      { id: standId, eventId, name: "Stand", type: "STAND", rarity: "RARE", xp: 100 },
      { id: otherBadgeId, eventId: otherEventId, name: "Ajeno", type: "CONTENT", rarity: "COMMON", xp: 50 },
    ]);
    await db.insert(eventMembership).values([
      ...people.map((person) => ({
        id: randomUUID(),
        eventId,
        userId: person.id,
        checkedInAt: new Date(Date.UTC(2026, 0, 1, 0, person.index)),
      })),
      { id: randomUUID(), eventId: otherEventId, userId: outsiderId, checkedInAt: new Date("2026-12-02T16:00:00Z") },
    ]);
    const latest = people[ATTENDANCE_PAGE_SIZE];
    await db.insert(badgeRedemption).values([
      ...people.map((person) => ({
        id: randomUUID(),
        badgeId: talkId,
        eventId,
        userId: person.id,
        createdAt: new Date(Date.UTC(2026, 0, 1, 1, person.index)),
      })),
      { id: randomUUID(), badgeId: standId, eventId, userId: latest.id, createdAt: new Date("2026-01-01T02:00:00Z") },
      { id: randomUUID(), badgeId: otherBadgeId, eventId: otherEventId, userId: outsiderId, createdAt: new Date("2026-12-02T17:00:00Z") },
    ]);
    await db.insert(eventCompletion).values({ id: randomUUID(), eventId, userId: latest.id });
  });

  afterAll(async () => {
    await db.delete(company).where(inArray(company.id, [companyId, otherCompanyId]));
    await db.delete(user).where(inArray(user.id, [...people.map((person) => person.id), outsiderId]));
    await db.delete(user).where(inArray(user.email, [adminEmail, participantEmail]));
  });

  it("lists only this event, pages without repeating, and hides another company's email", async () => {
    const first = await getEventAttendance(companyId, eventId, { page: 1, badgeId: null, badgePage: 1 });
    const second = await getEventAttendance(companyId, eventId, { page: 2, badgeId: null, badgePage: 1 });
    const latest = people[ATTENDANCE_PAGE_SIZE];
    const earliest = people[0];

    expect(first?.attendees).toHaveLength(ATTENDANCE_PAGE_SIZE);
    expect(first?.hasNextPage).toBe(true);
    expect(first?.attendees[0]).toMatchObject({ userId: latest.id, email: latest.email, badgeCount: 2, completed: true });
    expect(first?.attendees.some((row) => row.email === outsiderEmail)).toBe(false);
    expect(second?.attendees).toEqual([
      expect.objectContaining({ userId: earliest.id, badgeCount: 1, completed: false }),
    ]);
    const seen = new Set([...(first?.attendees ?? []), ...(second?.attendees ?? [])].map((row) => row.userId));
    expect(seen.size).toBe(ATTENDANCE_PAGE_SIZE + 1);
    expect(seen.has(outsiderId)).toBe(false);

    expect(await getEventAttendance(companyId, otherEventId, { page: 1, badgeId: null, badgePage: 1 })).toBeNull();
    expect(await getEventAttendance(otherCompanyId, eventId, { page: 1, badgeId: null, badgePage: 1 })).toBeNull();
  });

  it("pages redemptions per badge and ignores a badge from another event", async () => {
    const first = await getEventAttendance(companyId, eventId, { page: 1, badgeId: talkId, badgePage: 1 });
    const second = await getEventAttendance(companyId, eventId, { page: 1, badgeId: talkId, badgePage: 2 });
    const talkFirst = first?.badges.find((item) => item.badgeId === talkId);
    const talkSecond = second?.badges.find((item) => item.badgeId === talkId);
    const stand = first?.badges.find((item) => item.badgeId === standId);

    expect(talkFirst?.rows).toHaveLength(ATTENDANCE_PAGE_SIZE);
    expect(talkFirst?.hasNextPage).toBe(true);
    expect(talkSecond?.rows).toHaveLength(1);
    const seen = new Set([...(talkFirst?.rows ?? []), ...(talkSecond?.rows ?? [])].map((row) => row.userId));
    expect(seen.size).toBe(ATTENDANCE_PAGE_SIZE + 1);
    expect(stand?.rows.map((row) => row.userId)).toEqual([people[ATTENDANCE_PAGE_SIZE].id]);
    expect(first?.badges.some((item) => item.name === "Ajeno")).toBe(false);

    const ignored = await getEventAttendance(companyId, eventId, { page: 1, badgeId: otherBadgeId, badgePage: 2 });
    expect(ignored?.badgeId).toBeNull();
    expect(ignored?.badges.find((item) => item.badgeId === talkId)?.page).toBe(1);
  });

  it("redirects a participant and hides an event from another company", async () => {
    withCookie(participantCookie);
    await expect(EventAttendancePage({
      params: Promise.resolve({ companyId, eventId }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("REDIRECT:/home");

    withCookie(adminCookie);
    await expect(EventAttendancePage({
      params: Promise.resolve({ companyId, eventId: otherEventId }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("NOT_FOUND");
  });
});
