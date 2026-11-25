import { randomUUID } from "node:crypto";
import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { checkInEvent } from "@/app/lib/check-in";
import { hashDisplayToken, createDisplayToken } from "@/app/lib/qr-display";
import type { QrSubject } from "@/app/lib/qr-token";
import { extractScanToken } from "@/app/lib/scan-token";
import { verifyQrToken } from "@/app/lib/qr-token";
import { grantBadge } from "@/app/lib/redeem";
import type { ScanResult } from "@/app/lib/scan-message";
import { db } from "@/db";
import { scanHold } from "@/db/schema";

export const SCAN_HOLD_COOKIE = "scan_hold";
export const SCAN_HOLD_TTL_MS = 15 * 60 * 1000;

type HoldCookie = {
  name: string;
  value: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    secure: boolean;
    path: string;
    expires: Date;
  };
};

export type PreparedHold =
  | { ok: true; cookie: HoldCookie }
  | { ok: false; reason: "invalid" | "expired" };

/**
 * Records that this browser presented a still-valid QR, without storing the QR.
 * The cookie is what lets the same browser finish after creating an account.
 */
export async function prepareScanHold(token: string, now = new Date()): Promise<PreparedHold> {
  const verified = verifyQrToken(extractScanToken(token), now);
  if (!verified.ok) return verified;

  const { token: secret, hash } = createDisplayToken();
  const expiresAt = new Date(now.getTime() + SCAN_HOLD_TTL_MS);
  await db.insert(scanHold).values({
    id: randomUUID(),
    tokenHash: hash,
    kind: verified.kind,
    subjectId: verified.subjectId,
    expiresAt,
  });

  return { ok: true, cookie: holdCookie(secret, expiresAt) };
}

export async function writeScanHoldCookie(cookie: HoldCookie) {
  const store = await cookies();
  store.set(cookie.name, cookie.value, cookie.options);
}

export async function hasScanHold(now = new Date()) {
  return (await readOpenHold(now)) !== null;
}

/** Completes the held scan. An event that has not started leaves the hold in place. */
export async function completeScanHold(userId: string, now = new Date()): Promise<{ result: ScanResult; clearCookie: boolean } | null> {
  const row = await readOpenHold(now);
  if (!row) return null;

  const result: ScanResult = row.kind === "badge"
    ? { flow: "redeem", ...(await grantBadge(row.subjectId, userId)) }
    : { flow: "checkin", ...(await checkInEvent(row.subjectId, userId)) };

  const clearCookie = holdIsSpent(result);
  if (clearCookie) {
    await db.update(scanHold).set({ consumedAt: now }).where(eq(scanHold.id, row.id));
  }

  return { result, clearCookie };
}

function holdIsSpent(result: ScanResult) {
  if (result.ok) return true;
  return result.reason !== "event_not_started" && result.reason !== "disabled";
}

async function readOpenHold(now: Date): Promise<(QrSubject & { id: string }) | null> {
  let store;
  try {
    store = await cookies();
  } catch {
    return null;
  }

  const secret = store.get(SCAN_HOLD_COOKIE)?.value;
  if (!secret) return null;

  const [row] = await db
    .select({ id: scanHold.id, kind: scanHold.kind, subjectId: scanHold.subjectId })
    .from(scanHold)
    .where(and(eq(scanHold.tokenHash, hashDisplayToken(secret)), isNull(scanHold.consumedAt), gt(scanHold.expiresAt, now)));

  if (!row || (row.kind !== "badge" && row.kind !== "checkin")) return null;
  return { id: row.id, kind: row.kind, subjectId: row.subjectId };
}

function holdCookie(secret: string, expiresAt: Date): HoldCookie {
  return {
    name: SCAN_HOLD_COOKIE,
    value: secret,
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    },
  };
}
