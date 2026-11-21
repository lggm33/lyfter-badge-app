"use server";

import { and, asc, count, eq, exists, inArray, isNull, sql, sum } from "drizzle-orm";
import { refresh } from "next/cache";
import { requireSession } from "@/app/lib/authz";
import { eventPlaceSummary } from "@/app/lib/event-modality";
import { listPhotosForEvents } from "@/app/lib/event-photos";
import { getEventRewards, type EventRewards } from "@/app/lib/rewards";
import { db } from "@/db";
import {
  badge,
  badgeRedemption,
  company,
  companyMember,
  event,
  eventCompletion,
  eventMembership,
  raffleWin,
  xpLedger,
} from "@/db/schema";

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
        required: badge.required,
        redeemedAt: badgeRedemption.createdAt,
      })
      .from(badgeRedemption)
      .innerJoin(badge, eq(badgeRedemption.badgeId, badge.id))
      .innerJoin(event, eq(badgeRedemption.eventId, event.id))
      .innerJoin(xpLedger, eq(xpLedger.redemptionId, badgeRedemption.id))
      .where(eq(badgeRedemption.userId, userId)),
  ]);

  const eventIds = [...new Set([...memberships, ...redemptions].map((row) => row.eventId))];
  const [requiredRows, completionRows, rewards] =
    eventIds.length === 0
      ? [[], [], new Map<string, EventRewards>()]
      : await Promise.all([
          db
            .select({ eventId: badge.eventId, total: count() })
            .from(badge)
            .where(and(inArray(badge.eventId, eventIds), eq(badge.required, true)))
            .groupBy(badge.eventId),
          db
            .select({ eventId: eventCompletion.eventId })
            .from(eventCompletion)
            .where(and(eq(eventCompletion.userId, userId), inArray(eventCompletion.eventId, eventIds))),
          getEventRewards(userId, eventIds),
        ]);
  const events = groupHistory(memberships, redemptions, {
    requiredTotals: new Map(requiredRows.map((row) => [row.eventId, row.total])),
    completedEventIds: new Set(completionRows.map((row) => row.eventId)),
  });
  const [places, photos] = eventIds.length === 0
    ? [[], []]
    : await Promise.all([
        db
          .select({ id: event.id, country: event.country, modality: event.modality })
          .from(event)
          .where(inArray(event.id, eventIds)),
        listPhotosForEvents(eventIds),
      ]);
  const placeByEvent = new Map(places.map((place) => [place.id, place]));
  const photosByEvent = new Map<string, typeof photos>();
  for (const photo of photos) {
    const current = photosByEvent.get(photo.eventId) ?? [];
    current.push(photo);
    photosByEvent.set(photo.eventId, current);
  }

  return {
    totalXp: Number(totalRow[0]?.total ?? 0),
    events: events.map((item) => {
      const place = placeByEvent.get(item.eventId);
      return {
        ...item,
        place: eventPlaceSummary({ country: place?.country ?? null, modality: place?.modality ?? null }),
        photos: (photosByEvent.get(item.eventId) ?? []).map((photo) => ({ id: photo.id, url: photo.url, alt: photo.alt })),
        prize: rewards.get(item.eventId)?.prize ?? null,
        raffle: rewards.get(item.eventId)?.raffle ?? null,
      };
    }),
  };
}

/** Self-service claim of the general prize. Claiming twice leaves `claimed_at` as it was. */
export async function claimPrize(eventId: string) {
  const session = await requireSession();
  const userId = session.user.id;

  const claimed = await db
    .update(eventCompletion)
    .set({ claimedAt: new Date() })
    .where(
      and(
        eq(eventCompletion.userId, userId),
        eq(eventCompletion.eventId, eventId),
        isNull(eventCompletion.claimedAt),
        exists(db.select({ id: event.id }).from(event).where(and(eq(event.id, eventId), sql`${event.prizeTitle} is not null`))),
      ),
    )
    .returning({ id: eventCompletion.id });

  if (claimed.length === 0) {
    const [completion] = await db
      .select({ hasPrize: sql<boolean>`${event.prizeTitle} is not null` })
      .from(eventCompletion)
      .innerJoin(event, eq(eventCompletion.eventId, event.id))
      .where(and(eq(eventCompletion.userId, userId), eq(eventCompletion.eventId, eventId)));
    if (!completion) throw new Error("Todavía no completaste este evento.");
    if (!completion.hasPrize) throw new Error("Este evento no tiene premio.");
  }
  refresh();
}

/** Self-service claim of a raffle prize by its winner. Claiming twice leaves `claimed_at` as it was. */
export async function claimRaffleWin(winId: string) {
  const session = await requireSession();
  const userId = session.user.id;

  const claimed = await db
    .update(raffleWin)
    .set({ claimedAt: new Date() })
    .where(and(eq(raffleWin.id, winId), eq(raffleWin.userId, userId), isNull(raffleWin.claimedAt)))
    .returning({ id: raffleWin.id });

  if (claimed.length === 0) {
    const [win] = await db.select({ id: raffleWin.id }).from(raffleWin).where(and(eq(raffleWin.id, winId), eq(raffleWin.userId, userId)));
    if (!win) throw new Error("No ganaste este premio.");
  }
  refresh();
}

export async function getMyBadge(badgeId: string) {
  const session = await requireSession();
  const [rows, totalRow] = await Promise.all([
    db
      .select({
        redemptionId: badgeRedemption.id,
        badgeId: badge.id,
        name: badge.name,
        icon: badge.icon,
        eventId: event.id,
        eventName: event.name,
        xp: xpLedger.amount,
        completionId: eventCompletion.id,
      })
      .from(badgeRedemption)
      .innerJoin(badge, eq(badgeRedemption.badgeId, badge.id))
      .innerJoin(event, eq(badgeRedemption.eventId, event.id))
      .innerJoin(xpLedger, eq(xpLedger.redemptionId, badgeRedemption.id))
      .leftJoin(
        eventCompletion,
        and(eq(eventCompletion.eventId, event.id), eq(eventCompletion.userId, badgeRedemption.userId)),
      )
      .where(and(eq(badgeRedemption.userId, session.user.id), eq(badge.id, badgeId))),
    db.select({ total: sum(xpLedger.amount) }).from(xpLedger).where(eq(xpLedger.userId, session.user.id)),
  ]);

  const row = rows[0];
  if (!row) return null;
  const { completionId, ...badgeRow } = row;
  return {
    ...badgeRow,
    holderName: session.user.name,
    eventCompleted: completionId !== null,
    totalXp: Number(totalRow[0]?.total ?? 0),
  };
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
  required: boolean;
  redeemedAt: Date;
};

type EventProgress = {
  requiredTotals: Map<string, number>;
  completedEventIds: Set<string>;
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
  requiredTotal: number;
  requiredRedeemed: number;
  completed: boolean;
  badges: HistoryBadge[];
};

function groupHistory(memberships: MembershipRow[], redemptions: RedemptionRow[], progress: EventProgress) {
  const byEvent = new Map<string, HistoryEvent>();

  for (const membership of memberships) {
    byEvent.set(membership.eventId, {
      eventId: membership.eventId,
      eventName: membership.eventName,
      xp: 0,
      checkedInAt: membership.checkedInAt,
      requiredTotal: 0,
      requiredRedeemed: 0,
      completed: false,
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
    if (redemption.required) current.requiredRedeemed += 1;
    byEvent.set(redemption.eventId, current);
  }

  const events = [...byEvent.values()];
  for (const item of events) {
    item.badges.sort(byNewestRedemption);
    item.requiredTotal = progress.requiredTotals.get(item.eventId) ?? 0;
    item.completed = progress.completedEventIds.has(item.eventId);
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
    requiredTotal: 0,
    requiredRedeemed: 0,
    completed: false,
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
