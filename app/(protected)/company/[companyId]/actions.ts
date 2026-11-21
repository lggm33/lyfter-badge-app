"use server";

import { asc, and, count, desc, eq, exists, isNull, lte, not, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { ActionError, formResult, type ActionState } from "@/app/lib/action-error";
import { isEventModality } from "@/app/lib/event-modality";
import { blobStore, removeEventPhoto, storeEventPhoto } from "@/app/lib/event-photos";
import { auditActorName, recordAudit, type AuditEntry } from "@/app/lib/audit";
import { isImpersonatingCompany, requireCompanyAccess, requireCompanyMembership } from "@/app/lib/authz";
import { buildQrDisplay, createDisplayToken, renderQrSvg } from "@/app/lib/qr-display";
import type { QrDisplay } from "@/app/lib/qr-display";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { badge, company, event, eventCompletion, qrDisplay, rafflePrize, raffleWin } from "@/db/schema";

export type { QrDisplay } from "@/app/lib/qr-display";

/** Se autoprotege: hace falta sesión y membresía de esa empresa. */
export async function getMyCompany(companyId: string) {
  await requireCompanyMembership(companyId);
  const [row] = await db.select().from(company).where(eq(company.id, companyId));
  return row;
}

/** QR del check-in del evento, o de un badge puntual si se pasa `badgeId`. Rota sola: no persiste nada. */
export async function getQrDisplay(companyId: string, eventId: string, badgeId?: string): Promise<QrDisplay | null> {
  await requireCompanyMembership(companyId);
  const now = new Date();
  const [currentEvent] = await db.select().from(event).where(and(eq(event.id, eventId), eq(event.companyId, companyId)));
  if (!currentEvent) return null;
  const [currentBadge] = badgeId ? await db.select().from(badge).where(and(eq(badge.id, badgeId), eq(badge.eventId, eventId))) : [undefined];
  if (badgeId && !currentBadge) return null;
  return buildQrDisplay(currentEvent, currentBadge, now);
}

export type QrDisplayLinkState = { url: string; qrSvg: string } | { error: string } | null;

/** Crea un link de un solo uso para emparejar una pantalla con el QR rotativo de un evento (o un badge puntual). */
export async function createQrDisplayLink(prev: QrDisplayLinkState, formData: FormData): Promise<QrDisplayLinkState> {
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const badgeField = String(formData.get("badge") ?? "").trim();
  const session = await requireCompanyMembership(companyId);
  const now = new Date();
  const [currentEvent] = await db.select().from(event).where(and(eq(event.id, eventId), eq(event.companyId, companyId)));
  if (!currentEvent || currentEvent.status !== "ACTIVE" || currentEvent.endsAt <= now) {
    return { error: "Solo se pueden crear pantallas para eventos activos." };
  }
  let badgeId: string | null = null;
  if (badgeField) {
    const [currentBadge] = await db.select({ id: badge.id }).from(badge).where(and(eq(badge.id, badgeField), eq(badge.eventId, eventId)));
    if (!currentBadge) return { error: "El badge no existe." };
    badgeId = currentBadge.id;
  }
  const betterAuthUrl = process.env.BETTER_AUTH_URL;
  if (!betterAuthUrl) throw new Error("BETTER_AUTH_URL is not set");
  const { token, hash } = createDisplayToken();
  const displayId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(qrDisplay).values({ id: displayId, eventId, badgeId, linkTokenHash: hash, expiresAt: currentEvent.endsAt });
    await recordCompanyAudit(tx, session, companyId, {
      action: "display.created",
      companyId,
      eventId,
      resourceType: "display",
      resourceId: displayId,
      metadata: { badgeId: badgeId ?? "" },
    });
  });
  const url = `${betterAuthUrl}/display/claim/${token}`;
  return { url, qrSvg: await renderQrSvg(url) };
}

export type QrDisplayRow = { id: string; status: "pending" | "paired" | "revoked" | "expired"; createdAt: Date; claimedAt: Date | null };

function qrDisplayStatus(row: { revokedAt: Date | null; expiresAt: Date; claimedAt: Date | null }, now: Date): QrDisplayRow["status"] {
  if (row.revokedAt) return "revoked";
  if (row.expiresAt <= now) return "expired";
  if (row.claimedAt) return "paired";
  return "pending";
}

/** `badgeId` sin definir busca las pantallas de check-in (badge_id IS NULL). */
export async function listQrDisplays(companyId: string, eventId: string, badgeId?: string): Promise<QrDisplayRow[]> {
  await requireCompanyMembership(companyId);
  const [currentEvent] = await db.select({ id: event.id }).from(event).where(and(eq(event.id, eventId), eq(event.companyId, companyId)));
  if (!currentEvent) return [];
  const now = new Date();
  const rows = await db
    .select({ id: qrDisplay.id, createdAt: qrDisplay.createdAt, claimedAt: qrDisplay.claimedAt, revokedAt: qrDisplay.revokedAt, expiresAt: qrDisplay.expiresAt })
    .from(qrDisplay)
    .where(and(eq(qrDisplay.eventId, eventId), badgeId ? eq(qrDisplay.badgeId, badgeId) : isNull(qrDisplay.badgeId)))
    .orderBy(desc(qrDisplay.createdAt));
  return rows.map((row) => ({ id: row.id, createdAt: row.createdAt, claimedAt: row.claimedAt, status: qrDisplayStatus(row, now) }));
}

/** Revoca una pantalla emparejada o pendiente; la tablet lo ve en su próximo refresco. */
export async function revokeQrDisplay(formData: FormData): Promise<void> {
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const displayId = String(formData.get("displayId") ?? "");
  const badgeField = String(formData.get("badge") ?? "").trim();
  const session = await requireCompanyMembership(companyId);
  const [currentEvent] = await db.select({ id: event.id }).from(event).where(and(eq(event.id, eventId), eq(event.companyId, companyId)));
  if (currentEvent) {
    await db.transaction(async (tx) => {
      const [revoked] = await tx
        .update(qrDisplay)
        .set({ revokedAt: new Date() })
        .where(and(eq(qrDisplay.id, displayId), eq(qrDisplay.eventId, eventId), isNull(qrDisplay.revokedAt)))
        .returning({ id: qrDisplay.id, badgeId: qrDisplay.badgeId });
      if (!revoked) return;
      await recordCompanyAudit(tx, session, companyId, {
        action: "display.revoked",
        companyId,
        eventId,
        resourceType: "display",
        resourceId: revoked.id,
        metadata: { badgeId: revoked.badgeId ?? "" },
      });
    });
  }
  redirect(`/company/${companyId}/events/${eventId}/qr${badgeField ? `?badge=${badgeField}` : ""}`);
}

function eventInput(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const startsAt = new Date(String(formData.get("startsAt") ?? ""));
  const endsAt = new Date(String(formData.get("endsAt") ?? ""));

  if (!name || name.length > 160) throw new ActionError("El nombre debe tener entre 1 y 160 caracteres.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
    throw new ActionError("El slug solo puede usar minúsculas, números y guiones.");
  }
  if (Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf()) || startsAt >= endsAt) {
    throw new ActionError("Las fechas del evento no son válidas.");
  }
  if (startsAt <= new Date()) throw new ActionError("El evento no puede comenzar en el pasado.");

  const country = String(formData.get("country") ?? "").trim() || null;
  if (country && country.length > 80) throw new ActionError("El país no puede superar los 80 caracteres.");
  const modality = String(formData.get("modality") ?? "");
  if (!isEventModality(modality)) throw new ActionError("Elegí si el evento es presencial, virtual o híbrido.");

  return {
    name,
    slug,
    description: String(formData.get("description") ?? "").trim() || null,
    location: String(formData.get("location") ?? "").trim() || null,
    country,
    modality,
    startsAt,
    endsAt,
  };
}

export async function listMyCompanyEvents(companyId: string) {
  await requireCompanyMembership(companyId);
  await db
    .update(event)
    .set({ status: "FINISHED", updatedAt: new Date() })
    .where(and(eq(event.companyId, companyId), eq(event.status, "ACTIVE"), lte(event.endsAt, new Date())));
  const rows = await db.select().from(event).where(eq(event.companyId, companyId)).orderBy(asc(event.startsAt));
  const completions = await db
    .select({ eventId: eventCompletion.eventId, completed: count(), claimed: count(eventCompletion.claimedAt) })
    .from(eventCompletion)
    .innerJoin(event, eq(eventCompletion.eventId, event.id))
    .where(eq(event.companyId, companyId))
    .groupBy(eventCompletion.eventId);
  const completionsByEvent = new Map(completions.map((row) => [row.eventId, row]));
  const now = Date.now();
  return rows.map((row) => ({
    ...row,
    canActivate: row.status === "DRAFT" && now >= row.startsAt.getTime() - 24 * 60 * 60 * 1000 && now < row.endsAt.getTime(),
    prizeEditable: isOpenForPrizeEdits(row, now),
    canDrawRaffle: row.raffleDrawnAt === null && row.endsAt.getTime() <= now,
    completedCount: completionsByEvent.get(row.id)?.completed ?? 0,
    claimedCount: completionsByEvent.get(row.id)?.claimed ?? 0,
  }));
}

export async function createEvent(previousState: ActionState | FormData, maybeFormData?: FormData): Promise<ActionState> {
  const formData = maybeFormData ?? previousState as FormData;
  const companyId = String(formData.get("companyId") ?? "");
  const session = await requireCompanyMembership(companyId);
  const failure = await formResult(async () => {
    const input = eventInput(formData);
    const id = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(event).values({ id, companyId, ...input });
      await recordCompanyAudit(tx, session, companyId, {
        action: "event.created",
        companyId,
        eventId: id,
        resourceType: "event",
        resourceId: id,
        metadata: { slug: input.slug },
      });
    });
  }, "Ya existe un evento con ese slug en esta empresa.");
  if (failure) return failure;
  redirect(`/company/${companyId}`);
}

export async function updateEvent(previousState: ActionState | FormData, maybeFormData?: FormData): Promise<ActionState> {
  const formData = maybeFormData ?? previousState as FormData;
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const session = await requireCompanyMembership(companyId);
  const failure = await formResult(async () => {
    const input = eventInput(formData);
    await db.transaction(async (tx) => {
      const [current] = await tx.select().from(event).where(and(eq(event.id, eventId), eq(event.companyId, companyId)));
      if (!current) throw new ActionError("El evento no existe.");
      if (current.status !== "DRAFT") throw new ActionError("No se pueden editar eventos activados.");
      const [updated] = await tx.update(event).set({ ...input, updatedAt: new Date() }).where(and(eq(event.id, eventId), eq(event.companyId, companyId), eq(event.status, "DRAFT"))).returning({ id: event.id });
      if (!updated) throw new ActionError("El evento no existe.");
      await recordCompanyAudit(tx, session, companyId, {
        action: "event.updated",
        companyId,
        eventId,
        resourceType: "event",
        resourceId: eventId,
        metadata: { fields: changedFieldList(current, input, ["name", "slug", "description", "location", "country", "modality", "startsAt", "endsAt"]) },
      });
    });
  }, "Ya existe un evento con ese slug en esta empresa.");
  if (failure) return failure;
  redirect(`/company/${companyId}`);
}

export async function activateEvent(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const session = await requireCompanyMembership(companyId);
  const [current] = await db.select().from(event).where(and(eq(event.id, eventId), eq(event.companyId, companyId)));
  if (!current) throw new Error("El evento no existe.");
  if (current.status !== "DRAFT") throw new Error("Solo se pueden activar eventos en borrador.");
  const now = Date.now();
  if (now < current.startsAt.getTime() - 24 * 60 * 60 * 1000) throw new Error("El evento solo se puede activar durante las 24 horas previas.");
  if (now >= current.endsAt.getTime()) throw new Error("No se puede activar un evento ya finalizado.");
  // The badge checks live in the UPDATE so a badge deleted meanwhile cannot leave an active event with none.
  // With a prize or a raffle, nobody can complete the event unless one badge is required.
  const eventBadges = db.select({ id: badge.id }).from(badge).where(eq(badge.eventId, eventId));
  const requiredBadges = db.select({ id: badge.id }).from(badge).where(and(eq(badge.eventId, eventId), eq(badge.required, true)));
  const raffleEntries = db.select({ id: rafflePrize.id }).from(rafflePrize).where(eq(rafflePrize.eventId, eventId));
  const [activated] = await db.transaction(async (tx) => {
    const [row] = await tx.update(event).set({ status: "ACTIVE", updatedAt: new Date() }).where(and(
      eq(event.id, eventId),
      eq(event.companyId, companyId),
      eq(event.status, "DRAFT"),
      exists(eventBadges),
      or(exists(requiredBadges), and(isNull(event.prizeTitle), not(exists(raffleEntries)))),
    )).returning({ id: event.id });
    if (!row) return [];
    await recordCompanyAudit(tx, session, companyId, {
      action: "event.activated",
      companyId,
      eventId,
      resourceType: "event",
      resourceId: eventId,
    });
    return [row];
  });
  if (!activated) {
    const [hasBadge] = await eventBadges.limit(1);
    if (!hasBadge) throw new Error("Agregá al menos un badge antes de activar el evento.");
    throw new Error("Un evento con premio o rifa necesita al menos un badge requerido para activarse.");
  }
  redirect(`/company/${companyId}`);
}

export async function deleteEvent(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const session = await requireCompanyMembership(companyId);
  await db.transaction(async (tx) => {
    const [current] = await tx.select({ id: event.id }).from(event).where(and(eq(event.id, eventId), eq(event.companyId, companyId), eq(event.status, "DRAFT")));
    if (!current) return;
    await recordCompanyAudit(tx, session, companyId, {
      action: "event.deleted",
      companyId,
      eventId: current.id,
      resourceType: "event",
      resourceId: current.id,
    });
    await tx.delete(event).where(eq(event.id, current.id));
  });
  redirect(`/company/${companyId}`);
}

/** Closed means FINISHED or past endsAt: FINISHED is only written when an admin lists the events, so an expired ACTIVE one counts too. */
function isOpenForPrizeEdits(row: { status: string; endsAt: Date }, now = Date.now()) {
  return row.status !== "FINISHED" && row.endsAt.getTime() > now;
}

/** An empty title removes the general prize. */
export async function savePrize(previousState: ActionState | FormData, maybeFormData?: FormData): Promise<ActionState> {
  const formData = maybeFormData ?? previousState as FormData;
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const session = await requireCompanyAccess(companyId);
  const failure = await formResult(() => db.transaction(async (tx) => {
    const title = String(formData.get("prizeTitle") ?? "").trim();
    const description = String(formData.get("prizeDescription") ?? "").trim();
    if (title.length > 160) throw new ActionError("El título del premio no puede superar los 160 caracteres.");
    if (description.length > 1000) throw new ActionError("La descripción del premio no puede superar los 1000 caracteres.");

    const [current] = await tx.select({ status: event.status, endsAt: event.endsAt }).from(event).where(and(eq(event.id, eventId), eq(event.companyId, companyId))).for("update");
    if (!current) throw new ActionError("El evento no existe.");
    if (!isOpenForPrizeEdits(current)) throw new ActionError("No se puede editar el premio de un evento cerrado.");
    if (title) {
      const [required] = await tx.select({ id: badge.id }).from(badge).where(and(eq(badge.eventId, eventId), eq(badge.required, true))).limit(1);
      if (!required) throw new ActionError("Agregá al menos un badge requerido antes de guardar un premio.");
    }
    await tx.update(event).set({ prizeTitle: title || null, prizeDescription: title ? description || null : null, updatedAt: new Date() }).where(eq(event.id, eventId));
    await recordCompanyAudit(tx, session, companyId, {
      action: "prize.saved",
      companyId,
      eventId,
      resourceType: "prize",
      resourceId: eventId,
      metadata: title ? { title } : { removed: true },
    });
  }), "No se pudo guardar el premio.");
  if (failure) return failure;
  redirect(`/company/${companyId}`);
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Locks the event so an edit cannot interleave with the draw, and refuses once the raffle was drawn. */
async function lockUndrawnRaffle(tx: Tx, companyId: string, eventId: string) {
  const [current] = await tx.select({ raffleDrawnAt: event.raffleDrawnAt }).from(event).where(and(eq(event.id, eventId), eq(event.companyId, companyId))).for("update");
  if (!current) throw new ActionError("El evento no existe.");
  if (current.raffleDrawnAt) throw new ActionError("La rifa ya se sorteó: no se puede modificar.");
}

function rafflePrizeInput(formData: FormData) {
  const title = String(formData.get("raffleTitle") ?? "").trim();
  const description = String(formData.get("raffleDescription") ?? "").trim() || null;
  const quantity = Number(formData.get("raffleQuantity"));

  if (!title || title.length > 160) throw new ActionError("El título del premio debe tener entre 1 y 160 caracteres.");
  if (description && description.length > 1000) throw new ActionError("La descripción del premio no puede superar los 1000 caracteres.");
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10000) throw new ActionError("La cantidad debe ser un entero entre 1 y 10000.");
  return { title, description, quantity };
}

/** Creates the raffle prize, or edits it when the form carries a `prizeId`. */
export async function saveRafflePrize(previousState: ActionState | FormData, maybeFormData?: FormData): Promise<ActionState> {
  const formData = maybeFormData ?? previousState as FormData;
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const prizeId = String(formData.get("prizeId") ?? "");
  const session = await requireCompanyAccess(companyId);
  const failure = await formResult(() => db.transaction(async (tx) => {
    const input = rafflePrizeInput(formData);
    await lockUndrawnRaffle(tx, companyId, eventId);
    const [required] = await tx.select({ id: badge.id }).from(badge).where(and(eq(badge.eventId, eventId), eq(badge.required, true))).limit(1);
    if (!required) throw new ActionError("Agregá al menos un badge requerido antes de guardar un premio de la rifa.");
    const id = prizeId || randomUUID();
    if (!prizeId) {
      await tx.insert(rafflePrize).values({ id, eventId, ...input });
    } else {
      const [updated] = await tx.update(rafflePrize).set({ ...input, updatedAt: new Date() }).where(and(eq(rafflePrize.id, prizeId), eq(rafflePrize.eventId, eventId))).returning({ id: rafflePrize.id });
      if (!updated) throw new ActionError("El premio no existe.");
    }
    await recordCompanyAudit(tx, session, companyId, {
      action: "raffle_prize.saved",
      companyId,
      eventId,
      resourceType: "raffle",
      resourceId: id,
      metadata: { title: input.title },
    });
  }), "Ya existe un premio con ese título en esta rifa.");
  if (failure) return failure;
  redirect(`/company/${companyId}`);
}

export async function deleteRafflePrize(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const prizeId = String(formData.get("prizeId") ?? "");
  const session = await requireCompanyAccess(companyId);
  await db.transaction(async (tx) => {
    await lockUndrawnRaffle(tx, companyId, eventId);
    const [removed] = await tx.delete(rafflePrize).where(and(eq(rafflePrize.id, prizeId), eq(rafflePrize.eventId, eventId))).returning({ id: rafflePrize.id, title: rafflePrize.title });
    if (!removed) return;
    await recordCompanyAudit(tx, session, companyId, {
      action: "raffle_prize.deleted",
      companyId,
      eventId,
      resourceType: "raffle",
      resourceId: removed.id,
      metadata: { title: removed.title },
    });
  });
  redirect(`/company/${companyId}`);
}

/**
 * Draws the raffle once, after the event ends, among the people who completed it.
 * The FOR UPDATE on the event waits for the redemptions in flight (they hold FOR SHARE),
 * so a completion that commits late still enters the draw.
 */
export async function drawRaffle(previousState: ActionState | FormData, maybeFormData?: FormData): Promise<ActionState> {
  const formData = maybeFormData ?? previousState as FormData;
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const session = await requireCompanyAccess(companyId);
  const failure = await formResult(() => db.transaction(async (tx) => {
    const [current] = await tx.select({ endsAt: event.endsAt, raffleDrawnAt: event.raffleDrawnAt }).from(event).where(and(eq(event.id, eventId), eq(event.companyId, companyId))).for("update");
    if (!current) throw new ActionError("El evento no existe.");
    if (current.raffleDrawnAt) throw new ActionError("La rifa ya se sorteó.");
    if (current.endsAt > new Date()) throw new ActionError("La rifa se puede sortear cuando termina el evento.");
    const prizes = await tx.select().from(rafflePrize).where(eq(rafflePrize.eventId, eventId)).orderBy(asc(rafflePrize.createdAt), asc(rafflePrize.id));
    if (prizes.length === 0) throw new ActionError("Cargá al menos un premio antes de sortear.");

    const participants = await tx.select({ userId: eventCompletion.userId }).from(eventCompletion).where(eq(eventCompletion.eventId, eventId)).orderBy(sql`random()`);
    // Each person appears once in the shuffled list, so each wins at most one unit; leftover units stay unassigned.
    const wins: (typeof raffleWin.$inferInsert)[] = [];
    for (const prize of prizes) {
      for (let unit = 0; unit < prize.quantity && wins.length < participants.length; unit++) {
        wins.push({ id: randomUUID(), rafflePrizeId: prize.id, eventId, userId: participants[wins.length].userId });
      }
    }
    if (wins.length > 0) await tx.insert(raffleWin).values(wins);
    await tx.update(event).set({ raffleDrawnAt: new Date(), updatedAt: new Date() }).where(eq(event.id, eventId));
    await recordCompanyAudit(tx, session, companyId, {
      action: "raffle.drawn",
      companyId,
      eventId,
      resourceType: "raffle",
      resourceId: eventId,
      metadata: { winners: wins.length },
    });
  }), "No se pudo sortear la rifa.");
  if (failure) return failure;
  redirect(`/company/${companyId}`);
}

export async function listEventRaffle(companyId: string, eventId: string) {
  await companyEvent(companyId, eventId);
  const [prizes, winners] = await Promise.all([
    db
      .select({ id: rafflePrize.id, title: rafflePrize.title, description: rafflePrize.description, quantity: rafflePrize.quantity, assigned: count(raffleWin.id) })
      .from(rafflePrize)
      .leftJoin(raffleWin, eq(raffleWin.rafflePrizeId, rafflePrize.id))
      .where(eq(rafflePrize.eventId, eventId))
      .groupBy(rafflePrize.id)
      .orderBy(asc(rafflePrize.title)),
    db
      .select({ id: raffleWin.id, prizeTitle: rafflePrize.title, userName: user.name, claimedAt: raffleWin.claimedAt })
      .from(raffleWin)
      .innerJoin(rafflePrize, eq(raffleWin.rafflePrizeId, rafflePrize.id))
      .innerJoin(user, eq(raffleWin.userId, user.id))
      .where(eq(raffleWin.eventId, eventId))
      .orderBy(asc(rafflePrize.title), asc(user.name)),
  ]);
  return { prizes, winners };
}

const badgeTypes = ["CONTENT", "TALK", "STAND"] as const;
const badgeRarities = ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const;

async function companyEvent(companyId: string, eventId: string, draftOnly = false) {
  const session = await requireCompanyMembership(companyId);
  const [row] = await db.select({ id: event.id, status: event.status }).from(event).where(and(eq(event.id, eventId), eq(event.companyId, companyId)));
  if (!row) throw new ActionError("El evento no existe.");
  if (draftOnly && row.status !== "DRAFT") throw new ActionError("Solo se pueden modificar badges de eventos en borrador.");
  return { row, session };
}

function badgeInput(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const type = String(formData.get("type") ?? "");
  const rarity = String(formData.get("rarity") ?? "");
  const icon = String(formData.get("icon") ?? "").trim() || null;
  const xp = Number(formData.get("xp"));
  const required = formData.get("required") === "on";

  if (!name || name.length > 120) throw new ActionError("El nombre del badge debe tener entre 1 y 120 caracteres.");
  if (!badgeTypes.includes(type as (typeof badgeTypes)[number])) throw new ActionError("El tipo de badge no es válido.");
  if (!badgeRarities.includes(rarity as (typeof badgeRarities)[number])) throw new ActionError("La rareza del badge no es válida.");
  if (!Number.isInteger(xp) || xp < 0 || xp > 100000) throw new ActionError("La XP debe ser un entero entre 0 y 100000.");
  return { name, description, type, rarity, icon, xp, required };
}

export async function listEventBadges(companyId: string, eventId: string) {
  await companyEvent(companyId, eventId);
  return db.select().from(badge).where(eq(badge.eventId, eventId)).orderBy(asc(badge.name));
}

export async function createBadge(previousState: ActionState | FormData, maybeFormData?: FormData): Promise<ActionState> {
  const formData = maybeFormData ?? previousState as FormData;
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const failure = await formResult(async () => {
    const { row: current, session } = await companyEvent(companyId, eventId);
    const input = badgeInput(formData);
    // An active event only grows optional badges: a required one would change who already completed it,
    // and editing or deleting badges stays draft-only because redemptions and XP depend on them.
    if (current.status === "FINISHED") throw new ActionError("No se pueden agregar badges a un evento finalizado.");
    if (current.status === "ACTIVE" && input.required) throw new ActionError("En un evento activo solo se pueden agregar badges opcionales.");
    const id = randomUUID();
    await db.transaction(async (tx) => {
      await tx.insert(badge).values({ id, eventId, ...input });
      await recordCompanyAudit(tx, session, companyId, {
        action: "badge.created",
        companyId,
        eventId,
        resourceType: "badge",
        resourceId: id,
        metadata: { name: input.name },
      });
    });
  }, "Ya existe un badge con ese nombre en este evento.");
  if (failure) return failure;
  redirect(`/company/${companyId}`);
}

export async function updateBadge(previousState: ActionState | FormData, maybeFormData?: FormData): Promise<ActionState> {
  const formData = maybeFormData ?? previousState as FormData;
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const badgeId = String(formData.get("badgeId") ?? "");
  const failure = await formResult(async () => {
    const { session } = await companyEvent(companyId, eventId, true);
    const input = badgeInput(formData);
    await db.transaction(async (tx) => {
      const [current] = await tx.select().from(badge).where(and(eq(badge.id, badgeId), eq(badge.eventId, eventId)));
      if (!current) throw new ActionError("El badge no existe.");
      const [updated] = await tx.update(badge).set({ ...input, updatedAt: new Date() }).where(and(eq(badge.id, badgeId), eq(badge.eventId, eventId))).returning({ id: badge.id });
      if (!updated) throw new ActionError("El badge no existe.");
      await recordCompanyAudit(tx, session, companyId, {
        action: "badge.updated",
        companyId,
        eventId,
        resourceType: "badge",
        resourceId: badgeId,
        metadata: { name: input.name, fields: changedFieldList(current, input, ["name", "description", "type", "rarity", "icon", "xp", "required"]) },
      });
    });
  }, "Ya existe un badge con ese nombre en este evento.");
  if (failure) return failure;
  redirect(`/company/${companyId}`);
}

export async function deleteBadge(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const badgeId = String(formData.get("badgeId") ?? "");
  const { session } = await companyEvent(companyId, eventId, true);
  await db.transaction(async (tx) => {
    const [removed] = await tx.delete(badge).where(and(eq(badge.id, badgeId), eq(badge.eventId, eventId))).returning({ id: badge.id, name: badge.name });
    if (!removed) return;
    await recordCompanyAudit(tx, session, companyId, {
      action: "badge.deleted",
      companyId,
      eventId,
      resourceType: "badge",
      resourceId: removed.id,
      metadata: { name: removed.name },
    });
  });
  redirect(`/company/${companyId}`);
}

function actorOf(session: { user: { id: string; name: string; email?: string | null } }) {
  return { actorId: session.user.id, actorName: auditActorName(session.user) };
}

export async function uploadEventPhoto(previousState: ActionState | FormData, maybeFormData?: FormData): Promise<ActionState> {
  const formData = maybeFormData ?? previousState as FormData;
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const session = await requireCompanyMembership(companyId);
  const failure = await formResult(async () => {
    const file = formData.get("photo");
    if (!(file instanceof File) || file.size === 0) throw new ActionError("Elegí una foto.");
    await storeEventPhoto({
      companyId,
      eventId,
      bytes: new Uint8Array(await file.arrayBuffer()),
      caption: String(formData.get("alt") ?? "").trim() || null,
      store: blobStore(),
      audit: (tx, photoId) => recordPhotoAudit(tx, session, companyId, eventId, photoId, "photo.created"),
    });
  }, "No se pudo guardar la foto.");
  if (failure) return failure;
  redirect(`/company/${companyId}#eventos`);
}

export async function deleteEventPhoto(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const photoId = String(formData.get("photoId") ?? "");
  const session = await requireCompanyMembership(companyId);
  await removeEventPhoto({
    companyId,
    eventId,
    photoId,
    store: blobStore(),
    audit: (tx, id) => recordPhotoAudit(tx, session, companyId, eventId, id, "photo.deleted"),
  });
  redirect(`/company/${companyId}#eventos`);
}

async function recordPhotoAudit(
  tx: Parameters<typeof recordAudit>[0],
  session: { user: { id: string; name: string; email?: string | null } },
  companyId: string,
  eventId: string,
  photoId: string,
  action: "photo.created" | "photo.deleted",
) {
  await recordCompanyAudit(tx, session, companyId, {
    action,
    companyId,
    eventId,
    resourceType: "photo",
    resourceId: photoId,
  });
}

async function recordCompanyAudit(
  tx: Parameters<typeof recordAudit>[0],
  session: { user: { id: string; name: string; email?: string | null } },
  companyId: string,
  entry: Omit<AuditEntry, "actorId" | "actorName">,
) {
  const metadata = { ...(entry.metadata ?? {}) };
  if (await isImpersonatingCompany(session.user.id, companyId)) {
    metadata.impersonating = true;
  }

  await recordAudit(tx, {
    ...entry,
    ...actorOf(session),
    metadata: Object.keys(metadata).length > 0 ? metadata : null,
  });
}

function changedFieldList(before: object, after: object, fields: readonly string[]) {
  const previous = before as Record<string, unknown>;
  const next = after as Record<string, unknown>;
  return fields.filter((field) => !sameFieldValue(previous[field], next[field])).join(",");
}

function sameFieldValue(left: unknown, right: unknown) {
  if (left instanceof Date || right instanceof Date) {
    const leftTime = left instanceof Date ? left.getTime() : Number.NaN;
    const rightTime = right instanceof Date ? right.getTime() : Number.NaN;
    return leftTime === rightTime;
  }
  if (left == null && right == null) return true;
  return left === right;
}
