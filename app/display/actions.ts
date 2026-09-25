"use server";

import { and, eq, gt, isNull } from "drizzle-orm";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { buildQrDisplay, createDisplayToken, DISPLAY_COOKIE, hashDisplayToken } from "@/app/lib/qr-display";
import type { QrDisplay } from "@/app/lib/qr-display";
import { db } from "@/db";
import { badge, event, qrDisplay } from "@/db/schema";

export type { QrDisplay } from "@/app/lib/qr-display";

const CLAIM_ERROR = "Este link ya no es válido. Pedile uno nuevo al administrador.";

export type ClaimState = { error: string } | null;

/**
 * Reclamo atómico y de un solo uso: un `UPDATE` condicional decide quién gana si dos
 * dispositivos reclaman a la vez. El `deviceToken` es nuevo, nunca el token del link,
 * así que quien vio el link no puede fabricarse la cookie.
 */
export async function claimQrDisplay(prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const token = String(formData.get("token") ?? "").trim();
  if (!token) return { error: CLAIM_ERROR };
  const now = new Date();
  const { token: deviceToken, hash: deviceTokenHash } = createDisplayToken();
  const [row] = await db
    .update(qrDisplay)
    .set({ claimedAt: now, deviceTokenHash })
    .where(and(eq(qrDisplay.linkTokenHash, hashDisplayToken(token)), isNull(qrDisplay.claimedAt), isNull(qrDisplay.revokedAt), gt(qrDisplay.expiresAt, now)))
    .returning({ expiresAt: qrDisplay.expiresAt });
  if (!row) return { error: CLAIM_ERROR };
  (await cookies()).set(DISPLAY_COOKIE, deviceToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/display",
    expires: row.expiresAt,
  });
  redirect("/display");
}

/** No hace falta sesión: la pantalla se identifica por la cookie de dispositivo del emparejamiento. */
export async function getPairedDisplay(): Promise<QrDisplay | null> {
  const cookie = (await cookies()).get(DISPLAY_COOKIE);
  if (!cookie?.value) return null;
  const now = new Date();
  const [row] = await db
    .select({ event, badge })
    .from(qrDisplay)
    .innerJoin(event, eq(qrDisplay.eventId, event.id))
    .leftJoin(badge, eq(qrDisplay.badgeId, badge.id))
    .where(and(eq(qrDisplay.deviceTokenHash, hashDisplayToken(cookie.value)), isNull(qrDisplay.revokedAt), gt(qrDisplay.expiresAt, now)));
  if (!row) return null;
  return buildQrDisplay(row.event, row.badge ?? undefined, now);
}
