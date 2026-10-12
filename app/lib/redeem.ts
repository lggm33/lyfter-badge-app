import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { badge, badgeRedemption, event, eventMembership, xpLedger } from "@/db/schema";
import { extractScanToken } from "@/app/lib/check-in";
import type { RedeemResult } from "@/app/lib/scan-message";
import { verifyQrToken } from "@/app/lib/qr-token";

/**
 * Grants a badge and its XP once per signed-in user.
 * The session is the check-in: the badge's event gets a membership in the same
 * transaction, so a welcome scan is not required. A repeated token does not
 * add a second ledger row.
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
      .where(eq(badge.id, verified.subjectId));

    if (!row || row.eventStatus !== "ACTIVE" || row.endsAt <= new Date()) {
      return { ok: false, reason: "event_closed" };
    }

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
      };
    }

    const redemptionId = inserted[0].id;
    await tx.insert(xpLedger).values({
      id: randomUUID(),
      redemptionId,
      userId,
      amount: row.xp,
    });

    return {
      ok: true,
      outcome: "granted",
      badgeId: row.badgeId,
      badgeName: row.badgeName,
      eventName: row.eventName,
      xp: row.xp,
    };
  });
}
