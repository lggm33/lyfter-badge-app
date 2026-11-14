import { randomUUID } from "node:crypto";
import { and, count, eq, sum } from "drizzle-orm";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { badge, badgeRedemption, event, eventCompletion, eventMembership, xpLedger } from "@/db/schema";
import { extractScanToken } from "@/app/lib/check-in";
import { getLevelProgress } from "@/app/lib/levels";
import type { RedeemResult } from "@/app/lib/scan-message";
import { verifyQrToken } from "@/app/lib/qr-token";

/**
 * Grants a badge and its XP once per signed-in user.
 * The session is the check-in: the badge's event gets a membership in the same
 * transaction, so a welcome scan is not required. A repeated token does not
 * add a second ledger row. Granting the last required badge of the event
 * records its completion.
 */
export async function redeemBadge(token: string, userId: string | null): Promise<RedeemResult> {
  const verified = verifyQrToken(extractScanToken(token));
  if (!verified.ok) {
    return { ok: false, reason: verified.reason };
  }
  if (verified.kind !== "badge") {
    return { ok: false, reason: "invalid" };
  }
  if (!userId) {
    return { ok: false, reason: "unauthenticated" };
  }

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({
        badgeId: badge.id,
        badgeName: badge.name,
        xp: badge.xp,
        eventId: event.id,
        eventName: event.name,
        eventStatus: event.status,
        endsAt: event.endsAt,
      })
      .from(badge)
      .innerJoin(event, eq(badge.eventId, event.id))
      .where(eq(badge.id, verified.subjectId))
      // Redemptions share the lock; the raffle draw's FOR UPDATE waits for the ones in flight.
      .for("share", { of: event });

    if (!row || row.eventStatus !== "ACTIVE" || row.endsAt <= new Date()) {
      return { ok: false, reason: "event_closed" };
    }

    await tx.select({ id: user.id }).from(user).where(eq(user.id, userId)).for("update");

    await tx
      .insert(eventMembership)
      .values({
        id: randomUUID(),
        eventId: row.eventId,
        userId,
      })
      .onConflictDoNothing({
        target: [eventMembership.userId, eventMembership.eventId],
      });

    const inserted = await tx
      .insert(badgeRedemption)
      .values({
        id: randomUUID(),
        badgeId: row.badgeId,
        eventId: row.eventId,
        userId,
      })
      .onConflictDoNothing({
        target: [badgeRedemption.userId, badgeRedemption.badgeId],
      })
      .returning({ id: badgeRedemption.id });

    if (inserted.length === 0) {
      return {
        ok: true,
        outcome: "already_redeemed",
        badgeId: row.badgeId,
        badgeName: row.badgeName,
        eventName: row.eventName,
        xp: row.xp,
        levelUpTo: null,
        totalXpAfter: null,
        eventCompleted: false,
      };
    }

    const [totalRow] = await tx
      .select({ total: sum(xpLedger.amount) })
      .from(xpLedger)
      .where(eq(xpLedger.userId, userId));
    const previousXp = Number(totalRow?.total ?? 0);
    const previousLevel = getLevelProgress(previousXp).level;
    const totalXpAfter = previousXp + row.xp;
    const levelAfter = getLevelProgress(totalXpAfter).level;

    const redemptionId = inserted[0].id;
    await tx.insert(xpLedger).values({
      id: randomUUID(),
      redemptionId,
      userId,
      amount: row.xp,
    });

    // The user lock serializes this person's redemptions and the unique index
    // lets only the first insert return a row, so completion is revealed once.
    const [progress] = await tx
      .select({ requiredTotal: count(badge.id), requiredRedeemed: count(badgeRedemption.id) })
      .from(badge)
      .leftJoin(
        badgeRedemption,
        and(eq(badgeRedemption.badgeId, badge.id), eq(badgeRedemption.userId, userId)),
      )
      .where(and(eq(badge.eventId, row.eventId), eq(badge.required, true)));
    let eventCompleted = false;
    if (progress.requiredTotal > 0 && progress.requiredRedeemed === progress.requiredTotal) {
      const completion = await tx
        .insert(eventCompletion)
        .values({ id: randomUUID(), eventId: row.eventId, userId })
        .onConflictDoNothing({ target: [eventCompletion.userId, eventCompletion.eventId] })
        .returning({ id: eventCompletion.id });
      eventCompleted = completion.length > 0;
    }

    return {
      ok: true,
      outcome: "granted",
      badgeId: row.badgeId,
      badgeName: row.badgeName,
      eventName: row.eventName,
      xp: row.xp,
      levelUpTo: levelAfter > previousLevel ? levelAfter : null,
      totalXpAfter,
      eventCompleted,
    };
  });
}
