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

import AdminMetricsPage from "@/app/(protected)/admin/page";
import CompanyMetricsPage from "@/app/(protected)/company/[companyId]/metrics/page";
import { getMetrics, METRICS_TIME_ZONE, parseMetricsQuery } from "@/app/lib/metrics";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { badge, badgeRedemption, company, companyMember, event, eventCompletion, eventMembership } from "@/db/schema";
import { seedSuperAdmin } from "@/db/seed";
import { getNavigationItems } from "@/components/layout/navigation";
import { cookieHeader, postAuth, requireTestEnv, uniqueEmail } from "./helpers";

const password = "integration-test-password";
const adminEmail = uniqueEmail("metrics-admin");
const memberEmail = uniqueEmail("metrics-member");
const participantEmail = uniqueEmail("metrics-participant");

const companyA = randomUUID();
const companyB = randomUUID();
const eventA = randomUUID();
const eventDraft = randomUUID();
const eventB = randomUUID();
const talkA = randomUUID();
const standA = randomUUID();
const contentA = randomUUID();
const talkDraft = randomUUID();
const talkB = randomUUID();

const personA1 = randomUUID();
const personA2 = randomUUID();
const personDraft = randomUUID();
const peopleB = [randomUUID(), randomUUID(), randomUUID()];

const arrivalHour18 = "2026-06-16T00:30:00.000Z";
const arrivalHour0 = "2026-06-15T06:00:00.000Z";
const arrivalHour12 = "2026-06-15T18:00:00.000Z";
const arrivalHour3 = "2026-06-15T09:00:00.000Z";
const redemptionHour19 = "2026-06-16T01:15:00.000Z";
const redemptionHour6 = "2026-06-15T12:00:00.000Z";

let superCookie = "";
let memberCookie = "";
let participantCookie = "";

function withCookie(cookie?: string) {
  headersMock.mockResolvedValueOnce(new Headers(cookie ? { cookie } : undefined));
}

function hourInCostaRica(iso: string) {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: METRICS_TIME_ZONE,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(new Date(iso)).find((part) => part.type === "hour");
  return Number(hour?.value);
}

function bucket(traffic: { hour: number; arrivals: number; redemptions: number }[], hour: number) {
  return traffic.find((item) => item.hour === hour);
}

describe("metrics navigation", () => {
  it("adds the dashboard routes to both panels", () => {
    expect(getNavigationItems({ kind: "admin" }).map((item) => item.href)).toEqual([
      "/admin",
      "/admin/companies",
      "/admin/audit",
    ]);
    expect(getNavigationItems({ kind: "company", companyId: "company-1", companyName: "Acme" }).map((item) => item.href)).toContain(
      "/company/company-1/metrics",
    );
  });
});

describe("metrics", () => {
  beforeAll(async () => {
    requireTestEnv();
    await seedSuperAdmin({ email: adminEmail, password, name: "Metrics Super" });
    superCookie = cookieHeader(await postAuth("/sign-in/email", { email: adminEmail, password }));

    const memberSignUp = await postAuth("/sign-up/email", { name: "Metrics Member", email: memberEmail, password });
    const participantSignUp = await postAuth("/sign-up/email", { name: "Metrics Participant", email: participantEmail, password });
    expect(memberSignUp.status).toBe(200);
    expect(participantSignUp.status).toBe(200);
    const memberId = (await memberSignUp.json()).user.id;
    memberCookie = cookieHeader(await postAuth("/sign-in/email", { email: memberEmail, password }));
    participantCookie = cookieHeader(await postAuth("/sign-in/email", { email: participantEmail, password }));

    await db.insert(user).values([
      { id: personA1, name: "Persona A1", email: uniqueEmail("metrics-a1") },
      { id: personA2, name: "Persona A2", email: uniqueEmail("metrics-a2") },
      { id: personDraft, name: "Persona Draft", email: uniqueEmail("metrics-draft") },
      ...peopleB.map((id, index) => ({ id, name: `Persona B${index}`, email: uniqueEmail(`metrics-b${index}`) })),
    ]);
    await db.insert(company).values([
      { id: companyA, name: "Metrics A", slug: `metrics-a-${companyA}` },
      { id: companyB, name: "Metrics B", slug: `metrics-b-${companyB}` },
    ]);
    await db.insert(companyMember).values({ id: randomUUID(), companyId: companyA, userId: memberId, role: "COMPANY_ADMIN" });
    await db.insert(event).values([
      { id: eventA, companyId: companyA, name: "Metrics Day", slug: "metrics-day", status: "ACTIVE", startsAt: new Date("2026-06-15T16:00:00Z"), endsAt: new Date("2026-06-16T02:00:00Z") },
      { id: eventDraft, companyId: companyA, name: "Metrics Draft", slug: "metrics-draft", status: "DRAFT", startsAt: new Date("2026-07-01T16:00:00Z"), endsAt: new Date("2026-07-01T20:00:00Z") },
      { id: eventB, companyId: companyB, name: "Other Metrics", slug: "other-metrics", status: "ACTIVE", startsAt: new Date("2026-06-15T16:00:00Z"), endsAt: new Date("2026-06-16T02:00:00Z") },
    ]);
    await db.insert(badge).values([
      { id: talkA, eventId: eventA, name: "Apertura", type: "TALK", rarity: "COMMON", xp: 50 },
      { id: standA, eventId: eventA, name: "Stand de datos", type: "STAND", rarity: "RARE", xp: 50 },
      { id: contentA, eventId: eventA, name: "Contenido A", type: "CONTENT", rarity: "COMMON", xp: 50 },
      { id: talkDraft, eventId: eventDraft, name: "Cierre", type: "TALK", rarity: "COMMON", xp: 50 },
      { id: talkB, eventId: eventB, name: "Ajena", type: "TALK", rarity: "COMMON", xp: 50 },
    ]);
    await db.insert(eventMembership).values([
      { id: randomUUID(), eventId: eventA, userId: personA1, checkedInAt: new Date(arrivalHour18) },
      { id: randomUUID(), eventId: eventA, userId: personA2, checkedInAt: new Date(arrivalHour0) },
      { id: randomUUID(), eventId: eventDraft, userId: personDraft, checkedInAt: new Date(arrivalHour12) },
      ...peopleB.map((id) => ({ id: randomUUID(), eventId: eventB, userId: id, checkedInAt: new Date(arrivalHour3) })),
    ]);
    await db.insert(badgeRedemption).values([
      { id: randomUUID(), badgeId: talkA, eventId: eventA, userId: personA1, createdAt: new Date(redemptionHour19) },
      { id: randomUUID(), badgeId: talkA, eventId: eventA, userId: personA2, createdAt: new Date(redemptionHour6) },
      { id: randomUUID(), badgeId: standA, eventId: eventA, userId: personA1, createdAt: new Date(arrivalHour18) },
      { id: randomUUID(), badgeId: talkDraft, eventId: eventDraft, userId: personDraft, createdAt: new Date(arrivalHour12) },
      ...peopleB.map((id) => ({ id: randomUUID(), badgeId: talkB, eventId: eventB, userId: id, createdAt: new Date(arrivalHour3) })),
    ]);
    await db.insert(eventCompletion).values([
      { id: randomUUID(), eventId: eventA, userId: personA1 },
      { id: randomUUID(), eventId: eventB, userId: peopleB[0] },
    ]);
  });

  afterAll(async () => {
    await db.delete(company).where(inArray(company.id, [companyA, companyB]));
    await db.delete(user).where(inArray(user.id, [personA1, personA2, personDraft, ...peopleB]));
    await db.delete(user).where(inArray(user.email, [adminEmail, memberEmail, participantEmail]));
  });

  it("counts one company without seeing another, and drops a foreign event", async () => {
    const open = { eventId: null, badgeType: "ALL" as const };
    const companySnapshot = await getMetrics({ kind: "company", companyId: companyA }, open);
    const other = await getMetrics({ kind: "company", companyId: companyB }, open);
    const ignored = await getMetrics({ kind: "company", companyId: companyA }, { eventId: eventB, badgeType: "ALL" });
    const focused = await getMetrics({ kind: "company", companyId: companyA }, { eventId: eventA, badgeType: "ALL" });

    expect(companySnapshot.cards.companies).toBeNull();
    expect(companySnapshot.cards.users).toBeNull();
    expect(companySnapshot.topEvents).toBeNull();
    expect(companySnapshot.cards).toMatchObject({
      events: { draft: 1, active: 1, finished: 0 },
      checkIns: 3,
      redemptions: 4,
      completions: 1,
    });
    expect(companySnapshot.events.map((item) => item.id).sort()).toEqual([eventA, eventDraft].sort());
    expect(companySnapshot.topBadges.map((item) => item.name)).toEqual(["Apertura", "Cierre", "Stand de datos"]);
    expect(companySnapshot.topBadges.every((item) => item.companyId === companyA)).toBe(true);
    expect(companySnapshot.topBadges.some((item) => item.name === "Contenido A" || item.name === "Ajena")).toBe(false);

    expect(other.cards).toMatchObject({ checkIns: 3, redemptions: 3, completions: 1 });
    expect(other.topBadges.map((item) => item.badgeId)).toEqual([talkB]);

    expect(ignored.eventId).toBeNull();
    expect(ignored.cards).toEqual(companySnapshot.cards);
    expect(focused.eventId).toBe(eventA);
    expect(focused.cards).toMatchObject({
      events: { draft: 0, active: 1, finished: 0 },
      checkIns: 2,
      redemptions: 3,
      completions: 1,
    });
    expect(focused.topBadges.map((item) => item.badgeId)).toEqual([talkA, standA]);
  });

  it("keeps talks out of a stand filter and buckets hours in Costa Rica", async () => {
    expect(hourInCostaRica(arrivalHour18)).toBe(18);
    expect(hourInCostaRica(arrivalHour0)).toBe(0);
    expect(hourInCostaRica(redemptionHour19)).toBe(19);
    expect(hourInCostaRica(redemptionHour6)).toBe(6);

    const stands = await getMetrics({ kind: "company", companyId: companyA }, { eventId: null, badgeType: "STAND" });
    const talks = await getMetrics({ kind: "company", companyId: companyA }, { eventId: eventA, badgeType: "TALK" });

    expect(stands.topBadges.map((item) => item.type)).toEqual(["STAND"]);
    expect(stands.topBadges.map((item) => item.badgeId)).toEqual([standA]);
    expect(stands.cards.checkIns).toBe(3);
    expect(talks.topBadges.map((item) => ({ id: item.badgeId, type: item.type }))).toEqual([
      { id: talkA, type: "TALK" },
    ]);

    const traffic = talks.traffic;
    expect(traffic).toHaveLength(24);
    expect(bucket(traffic, 18)).toMatchObject({ arrivals: 1, redemptions: 1 });
    expect(bucket(traffic, 0)).toMatchObject({ arrivals: 1, redemptions: 0 });
    expect(bucket(traffic, 19)).toMatchObject({ arrivals: 0, redemptions: 1 });
    expect(bucket(traffic, 6)).toMatchObject({ arrivals: 0, redemptions: 1 });
    expect(bucket(traffic, 12)).toMatchObject({ arrivals: 0, redemptions: 0 });
    expect(bucket(traffic, 3)).toMatchObject({ arrivals: 0, redemptions: 0 });

    const openTraffic = stands.traffic;
    expect(bucket(openTraffic, 12)).toMatchObject({ arrivals: 1, redemptions: 1 });
    expect(bucket(openTraffic, 3)).toMatchObject({ arrivals: 0, redemptions: 0 });
  });

  it("rolls both companies up on the platform and ignores an unknown type", async () => {
    expect(parseMetricsQuery({ event: eventA, type: "CONTENT" })).toEqual({ eventId: eventA, badgeType: "ALL" });
    expect(parseMetricsQuery({ type: ["STAND"] })).toEqual({ eventId: null, badgeType: "STAND" });

    const platform = await getMetrics({ kind: "platform" }, { eventId: null, badgeType: "TALK" });
    const talkIds = platform.topBadges.map((item) => item.badgeId);

    expect(platform.cards.companies).toBeGreaterThanOrEqual(2);
    expect(platform.cards.users).toBeGreaterThanOrEqual(3);
    expect(platform.cards.checkIns).toBeGreaterThanOrEqual(6);
    expect(platform.topEvents?.find((item) => item.eventId === eventB)?.checkIns).toBe(3);
    expect(platform.topEvents?.find((item) => item.eventId === eventA)?.checkIns).toBe(2);
    expect(talkIds.indexOf(talkB)).toBeGreaterThanOrEqual(0);
    expect(talkIds.indexOf(talkB)).toBeLessThan(talkIds.indexOf(talkA));
    expect(platform.topBadges.every((item) => item.type === "TALK")).toBe(true);
    expect(platform.topBadges.some((item) => item.badgeId === standA)).toBe(false);
    expect(platform.events.some((item) => item.id === eventB)).toBe(true);
  });

  it("keeps each role on its own metrics route", async () => {
    withCookie(participantCookie);
    await expect(CompanyMetricsPage({
      params: Promise.resolve({ companyId: companyA }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("REDIRECT:/home");

    withCookie(memberCookie);
    await expect(AdminMetricsPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/home");

    withCookie(memberCookie);
    await expect(CompanyMetricsPage({
      params: Promise.resolve({ companyId: companyB }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("REDIRECT:/home");

    withCookie(memberCookie);
    await expect(CompanyMetricsPage({
      params: Promise.resolve({ companyId: randomUUID() }),
      searchParams: Promise.resolve({}),
    })).rejects.toThrow("REDIRECT:/home");

    withCookie(memberCookie);
    await expect(CompanyMetricsPage({
      params: Promise.resolve({ companyId: companyA }),
      searchParams: Promise.resolve({ event: eventB }),
    })).resolves.toBeTruthy();

    withCookie(superCookie);
    await expect(AdminMetricsPage({ searchParams: Promise.resolve({ type: "STAND" }) })).resolves.toBeTruthy();
  });
});
