import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { badge, badgeRedemption, event, eventCompletion, eventMembership } from "@/db/schema";

export const ATTENDANCE_PAGE_SIZE = 50;

export type AttendanceQuery = {
  page: number;
  badgeId: string | null;
  badgePage: number;
};

export type AttendeeRow = {
  userId: string;
  name: string;
  email: string;
  checkedInAt: Date;
  badgeCount: number;
  completed: boolean;
};

export type BadgeRedemptionPage = {
  badgeId: string;
  name: string;
  icon: string | null;
  page: number;
  hasNextPage: boolean;
  rows: { userId: string; name: string; redeemedAt: Date }[];
};

export type EventAttendance = {
  eventId: string;
  eventName: string;
  page: number;
  hasNextPage: boolean;
  attendees: AttendeeRow[];
  badgeId: string | null;
  badges: BadgeRedemptionPage[];
};

type SearchValue = string | string[] | undefined;

export type AttendanceSearchParams = {
  page?: SearchValue;
  badge?: SearchValue;
  badgePage?: SearchValue;
};

type PageBounds = { page: number; limit: number; offset: number };

/**
 * Attendees and per-badge redemptions for one event that belongs to the company.
 * An event id from another company returns null, so its emails never leave the query.
 */
export async function getEventAttendance(
  companyId: string,
  eventId: string,
  query: AttendanceQuery,
): Promise<EventAttendance | null> {
  const owned = await findOwnedEvent(companyId, eventId);
  if (!owned) return null;

  const attendeeBounds = pageBounds(query.page);
  const [attendees, eventBadges] = await Promise.all([
    listAttendees(eventId, attendeeBounds),
    listBadges(eventId),
  ]);
  const selectedBadgeId = eventBadges.some((item) => item.id === query.badgeId) ? query.badgeId : null;
  const badges = await Promise.all(
    eventBadges.map((item) => listRedemptions(eventId, item, selectedBadgeId === item.id ? query.badgePage : 1)),
  );

  return {
    eventId: owned.id,
    eventName: owned.name,
    page: attendeeBounds.page,
    hasNextPage: attendees.hasNextPage,
    attendees: attendees.rows,
    badgeId: selectedBadgeId,
    badges,
  };
}

export function parseAttendanceQuery(params: AttendanceSearchParams): AttendanceQuery {
  const badgeId = firstParam(params.badge).trim();
  return {
    page: positivePage(firstParam(params.page)),
    badgeId: badgeId.length > 0 ? badgeId : null,
    badgePage: positivePage(firstParam(params.badgePage)),
  };
}

async function findOwnedEvent(companyId: string, eventId: string) {
  const [row] = await db
    .select({ id: event.id, name: event.name })
    .from(event)
    .where(and(eq(event.id, eventId), eq(event.companyId, companyId)));
  return row ?? null;
}

async function listAttendees(eventId: string, bounds: PageBounds) {
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      email: user.email,
      checkedInAt: eventMembership.checkedInAt,
      badgeCount: count(badgeRedemption.id),
      completed: sql<boolean>`bool_or(${eventCompletion.id} is not null)`.as("completed"),
    })
    .from(eventMembership)
    .innerJoin(user, eq(user.id, eventMembership.userId))
    .leftJoin(
      badgeRedemption,
      and(eq(badgeRedemption.userId, eventMembership.userId), eq(badgeRedemption.eventId, eventMembership.eventId)),
    )
    .leftJoin(
      eventCompletion,
      and(eq(eventCompletion.userId, eventMembership.userId), eq(eventCompletion.eventId, eventMembership.eventId)),
    )
    .where(eq(eventMembership.eventId, eventId))
    .groupBy(user.id, user.name, user.email, eventMembership.checkedInAt)
    .orderBy(desc(eventMembership.checkedInAt), asc(user.id))
    .limit(bounds.limit)
    .offset(bounds.offset);

  return takePage(
    rows.map((row) => ({
      userId: row.userId,
      name: row.name,
      email: row.email,
      checkedInAt: row.checkedInAt,
      badgeCount: Number(row.badgeCount),
      completed: row.completed === true,
    })),
    bounds.page,
  );
}

async function listBadges(eventId: string) {
  return db
    .select({ id: badge.id, name: badge.name, icon: badge.icon })
    .from(badge)
    .where(eq(badge.eventId, eventId))
    .orderBy(asc(badge.createdAt), asc(badge.name));
}

async function listRedemptions(
  eventId: string,
  item: { id: string; name: string; icon: string | null },
  page: number,
) {
  const bounds = pageBounds(page);
  const rows = await db
    .select({
      userId: user.id,
      name: user.name,
      redeemedAt: badgeRedemption.createdAt,
    })
    .from(badgeRedemption)
    .innerJoin(user, eq(user.id, badgeRedemption.userId))
    .where(and(eq(badgeRedemption.badgeId, item.id), eq(badgeRedemption.eventId, eventId)))
    .orderBy(desc(badgeRedemption.createdAt), asc(user.id))
    .limit(bounds.limit)
    .offset(bounds.offset);
  const visible = takePage(rows, bounds.page);

  return {
    badgeId: item.id,
    name: item.name,
    icon: item.icon,
    page: visible.page,
    hasNextPage: visible.hasNextPage,
    rows: visible.rows,
  };
}

function pageBounds(page: number): PageBounds {
  const current = positivePage(String(page));
  return {
    page: current,
    limit: ATTENDANCE_PAGE_SIZE + 1,
    offset: (current - 1) * ATTENDANCE_PAGE_SIZE,
  };
}

function takePage<T>(rows: T[], page: number) {
  const hasNextPage = rows.length > ATTENDANCE_PAGE_SIZE;
  return {
    page,
    hasNextPage,
    rows: hasNextPage ? rows.slice(0, ATTENDANCE_PAGE_SIZE) : rows,
  };
}

function positivePage(value: string) {
  const page = Number.parseInt(value, 10);
  if (!Number.isFinite(page) || page < 1) return 1;
  return page;
}

function firstParam(value: SearchValue) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
