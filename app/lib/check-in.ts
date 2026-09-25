import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { event, eventMembership } from "@/db/schema";
import { verifyQrToken } from "@/app/lib/qr-token";
import type { CheckInResult } from "@/app/lib/check-in-message";

export type { CheckInFailure, CheckInResult, CheckInSuccess } from "@/app/lib/check-in-message";

/** Accepts a raw token or a /scan URL that carries ?t=. */
export function extractScanToken(input: string) {
  const trimmed = input.trim();
  const fromQuery = tokenFromScanUrl(trimmed);
  return fromQuery ?? trimmed;
}

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

  const [openEvent] = await db
    .select({ id: event.id, name: event.name, status: event.status, endsAt: event.endsAt })
    .from(event)
    .where(eq(event.id, verified.subjectId));

  if (!openEvent || openEvent.status !== "ACTIVE" || openEvent.endsAt <= new Date()) {
    return { ok: false, reason: "event_closed" };
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

function tokenFromScanUrl(value: string) {
  if (value.startsWith("/scan?") || value.startsWith("scan?")) {
    const query = value.slice(value.indexOf("?") + 1);
    return new URLSearchParams(query).get("t");
  }

  try {
    const url = new URL(value);
    if (url.pathname === "/scan" || url.pathname.endsWith("/scan")) {
      return url.searchParams.get("t");
    }
  } catch {
    return null;
  }

  return null;
}
