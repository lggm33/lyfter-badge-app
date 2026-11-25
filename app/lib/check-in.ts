import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { event, eventMembership } from "@/db/schema";
import { verifyQrToken } from "@/app/lib/qr-token";
import { extractScanToken } from "@/app/lib/scan-token";
import type { CheckInResult } from "@/app/lib/check-in-message";
import { isUserDisabled } from "@/app/lib/user-status";

export type { CheckInFailure, CheckInResult, CheckInSuccess } from "@/app/lib/check-in-message";
export { extractScanToken } from "@/app/lib/scan-token";

/**
 * Records event attendance for the signed-in user.
 * The user id comes from the session, never from the client.
 * Identity is (user_id, event_id): a repeated token does not insert a second row.
 */
export async function checkIn(token: string, userId: string | null): Promise<CheckInResult> {
  const verified = verifyQrToken(extractScanToken(token));
  if (!verified.ok) {
    return { ok: false, reason: verified.reason };
  }

  if (verified.kind !== "checkin") {
    return { ok: false, reason: "not_checkin" };
  }

  if (!userId) {
    return { ok: false, reason: "unauthenticated" };
  }

  return checkInEvent(verified.subjectId, userId);
}

/** Check-in for a subject already accepted at scan time. The caller skips the QR age. */
export async function checkInEvent(eventId: string, userId: string): Promise<CheckInResult> {
  if (await isUserDisabled(userId)) {
    return { ok: false, reason: "disabled" };
  }

  const now = new Date();
  const [openEvent] = await db
    .select({ id: event.id, name: event.name, status: event.status, startsAt: event.startsAt, endsAt: event.endsAt })
    .from(event)
    .where(eq(event.id, eventId));

  if (!openEvent || openEvent.status !== "ACTIVE" || openEvent.endsAt <= now) {
    return { ok: false, reason: "event_closed" };
  }
  if (openEvent.startsAt > now) {
    return { ok: false, reason: "event_not_started" };
  }

  const inserted = await db
    .insert(eventMembership)
    .values({
      id: randomUUID(),
      eventId: openEvent.id,
      userId,
    })
    .onConflictDoNothing({
      target: [eventMembership.userId, eventMembership.eventId],
    })
    .returning({ checkedInAt: eventMembership.checkedInAt });

  return {
    ok: true,
    outcome: inserted.length > 0 ? "checked_in" : "already_checked_in",
    eventId: openEvent.id,
    eventName: openEvent.name,
  };
}
