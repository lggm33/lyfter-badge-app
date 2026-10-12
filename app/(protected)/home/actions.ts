"use server";

import { and, asc, eq, sum } from "drizzle-orm";
import { requireSession } from "@/app/lib/authz";
import { db } from "@/db";
import { badge, badgeRedemption, company, companyMember, event, eventMembership, xpLedger } from "@/db/schema";

export async function listMyCompanies() {
  const session = await requireSession();

  return db
    .select({
      id: company.id,
      name: company.name,
    })
    .from(companyMember)
    .innerJoin(company, eq(companyMember.companyId, company.id))
    .where(eq(companyMember.userId, session.user.id))
    .orderBy(asc(company.name));
}

export async function listMyCollection() {
  const session = await requireSession();
  const userId = session.user.id;

  const [totalRow, memberships, redemptions] = await Promise.all([
    db
      .select({ total: sum(xpLedger.amount) })
      .from(xpLedger)
      .where(eq(xpLedger.userId, userId)),
    db
      .select({
        eventId: event.id,
        eventName: event.name,
        checkedInAt: eventMembership.checkedInAt,
      })
      .from(eventMembership)
      .innerJoin(event, eq(eventMembership.eventId, event.id))
      .where(eq(eventMembership.userId, userId)),
    db
      .select({
        redemptionId: badgeRedemption.id,
        badgeId: badge.id,
        name: badge.name,
        icon: badge.icon,
        eventId: event.id,
        eventName: event.name,
        xp: xpLedger.amount,
        redeemedAt: badgeRedemption.createdAt,
      })
      .from(badgeRedemption)
      .innerJoin(badge, eq(badgeRedemption.badgeId, badge.id))
      .innerJoin(event, eq(badgeRedemption.eventId, event.id))
      .innerJoin(xpLedger, eq(xpLedger.redemptionId, badgeRedemption.id))
      .where(eq(badgeRedemption.userId, userId)),
  ]);

  return {
    totalXp: Number(totalRow[0]?.total ?? 0),
    events: groupHistory(memberships, redemptions),
  };
}

export async function getMyBadge(badgeId: string) {
  const session = await requireSession();
  const [row] = await db
    .select({
      badgeId: badge.id,
      name: badge.name,
      icon: badge.icon,
      eventName: event.name,
      xp: xpLedger.amount,
    })
    .from(badgeRedemption)
    .innerJoin(badge, eq(badgeRedemption.badgeId, badge.id))
    .innerJoin(event, eq(badgeRedemption.eventId, event.id))
    .innerJoin(xpLedger, eq(xpLedger.redemptionId, badgeRedemption.id))
    .where(and(eq(badgeRedemption.userId, session.user.id), eq(badge.id, badgeId)));

  return row ?? null;
}

type MembershipRow = {
  eventId: string;
  eventName: string;
  checkedInAt: Date;
};

type RedemptionRow = {
  redemptionId: string;
  badgeId: string;
  name: string;
  icon: string | null;
  eventId: string;
  eventName: string;
  xp: number;
  redeemedAt: Date;
};

type HistoryBadge = {
  redemptionId: string;
  badgeId: string;
  name: string;
  icon: string | null;
  xp: number;
  redeemedAt: Date;
};

type HistoryEvent = {
  eventId: string;
  eventName: string;
  xp: number;
  checkedInAt: Date | null;
  badges: HistoryBadge[];
};

function groupHistory(memberships: MembershipRow[], redemptions: RedemptionRow[]) {
  const byEvent = new Map<string, HistoryEvent>();

  for (const membership of memberships) {
    byEvent.set(membership.eventId, {
      eventId: membership.eventId,
      eventName: membership.eventName,
      xp: 0,
      checkedInAt: membership.checkedInAt,
      badges: [],
    });
  }

  for (const redemption of redemptions) {
    const current = byEvent.get(redemption.eventId) ?? emptyEvent(redemption);
    current.badges.push({
      redemptionId: redemption.redemptionId,
      badgeId: redemption.badgeId,
      name: redemption.name,
      icon: redemption.icon,
      xp: Number(redemption.xp),
      redeemedAt: redemption.redeemedAt,
    });
    current.xp += Number(redemption.xp);
    byEvent.set(redemption.eventId, current);
  }

  const events = [...byEvent.values()];
  for (const item of events) {
    item.badges.sort(byNewestRedemption);
  }
  events.sort(byRecentActivity);
  return events;
}

function emptyEvent(redemption: RedemptionRow): HistoryEvent {
  return {
    eventId: redemption.eventId,
    eventName: redemption.eventName,
    xp: 0,
    checkedInAt: null,
    badges: [],
  };
}

function byNewestRedemption(left: HistoryBadge, right: HistoryBadge) {
  return right.redeemedAt.getTime() - left.redeemedAt.getTime();
}

function byRecentActivity(left: HistoryEvent, right: HistoryEvent) {
  const difference = activityAt(right) - activityAt(left);
  if (difference !== 0) return difference;
  return left.eventName.localeCompare(right.eventName);
}

function activityAt(item: HistoryEvent) {
  const checkIn = item.checkedInAt?.getTime() ?? 0;
  const newestBadge = item.badges[0]?.redeemedAt.getTime() ?? 0;
  return Math.max(checkIn, newestBadge);
}
