"use server";

import { asc, and, desc, eq, isNull, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { requireCompanyMembership } from "@/app/lib/authz";
import { buildQrDisplay, createDisplayToken, renderQrSvg } from "@/app/lib/qr-display";
import type { QrDisplay } from "@/app/lib/qr-display";
import { db } from "@/db";
import { badge, company, event, qrDisplay } from "@/db/schema";

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
  await requireCompanyMembership(companyId);
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
  await db.insert(qrDisplay).values({ id: randomUUID(), eventId, badgeId, linkTokenHash: hash, expiresAt: currentEvent.endsAt });
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
  await requireCompanyMembership(companyId);
  const [currentEvent] = await db.select({ id: event.id }).from(event).where(and(eq(event.id, eventId), eq(event.companyId, companyId)));
  if (currentEvent) {
    await db.update(qrDisplay).set({ revokedAt: new Date() }).where(and(eq(qrDisplay.id, displayId), eq(qrDisplay.eventId, eventId), isNull(qrDisplay.revokedAt)));
  }
  redirect(`/company/${companyId}/events/${eventId}/qr${badgeField ? `?badge=${badgeField}` : ""}`);
}

function eventInput(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const startsAt = new Date(String(formData.get("startsAt") ?? ""));
  const endsAt = new Date(String(formData.get("endsAt") ?? ""));

  if (!name || name.length > 160) throw new Error("El nombre debe tener entre 1 y 160 caracteres.");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) {
    throw new Error("El slug solo puede usar minúsculas, números y guiones.");
  }
  if (Number.isNaN(startsAt.valueOf()) || Number.isNaN(endsAt.valueOf()) || startsAt >= endsAt) {
    throw new Error("Las fechas del evento no son válidas.");
  }
  if (startsAt <= new Date()) throw new Error("El evento no puede comenzar en el pasado.");

  return { name, slug, description: String(formData.get("description") ?? "").trim() || null, location: String(formData.get("location") ?? "").trim() || null, startsAt, endsAt };
}

export async function listMyCompanyEvents(companyId: string) {
  await requireCompanyMembership(companyId);
  await db
    .update(event)
    .set({ status: "FINISHED", updatedAt: new Date() })
    .where(and(eq(event.companyId, companyId), eq(event.status, "ACTIVE"), lte(event.endsAt, new Date())));
  const rows = await db.select().from(event).where(eq(event.companyId, companyId)).orderBy(asc(event.startsAt));
  const now = Date.now();
  return rows.map((row) => ({ ...row, canActivate: row.status === "DRAFT" && now >= row.startsAt.getTime() - 24 * 60 * 60 * 1000 && now < row.endsAt.getTime() }));
}

type EventFormState = { error?: string } | null;

export async function createEvent(previousState: EventFormState | FormData, maybeFormData?: FormData): Promise<EventFormState> {
  const formData = maybeFormData ?? previousState as FormData;
  const companyId = String(formData.get("companyId") ?? "");
  await requireCompanyMembership(companyId);
  let input;
  try {
    input = eventInput(formData);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Los datos del evento no son válidos." };
  }
  try {
    await db.insert(event).values({ id: randomUUID(), companyId, ...input });
  } catch (error) {
    const cause = error as { code?: string; cause?: { code?: string } };
    if (cause.code === "23505" || cause.cause?.code === "23505") return { error: "Ya existe un evento con ese slug en esta empresa." };
    throw error;
  }
  redirect(`/company/${companyId}`);
}

export async function updateEvent(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  await requireCompanyMembership(companyId);
  const [current] = await db.select({ status: event.status }).from(event).where(and(eq(event.id, eventId), eq(event.companyId, companyId)));
  if (!current) throw new Error("El evento no existe.");
  if (current.status !== "DRAFT") throw new Error("No se pueden editar eventos activados.");
  const input = eventInput(formData);
  const [updated] = await db.update(event).set({ ...input, updatedAt: new Date() }).where(and(eq(event.id, eventId), eq(event.companyId, companyId), eq(event.status, "DRAFT"))).returning({ id: event.id });
  if (!updated) throw new Error("El evento no existe.");
  redirect(`/company/${companyId}`);
}

export async function activateEvent(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  await requireCompanyMembership(companyId);
  const [current] = await db.select().from(event).where(and(eq(event.id, eventId), eq(event.companyId, companyId)));
  if (!current) throw new Error("El evento no existe.");
  if (current.status !== "DRAFT") throw new Error("Solo se pueden activar eventos en borrador.");
  const now = Date.now();
  if (now < current.startsAt.getTime() - 24 * 60 * 60 * 1000) throw new Error("El evento solo se puede activar durante las 24 horas previas.");
  if (now >= current.endsAt.getTime()) throw new Error("No se puede activar un evento ya finalizado.");
  await db.update(event).set({ status: "ACTIVE", updatedAt: new Date() }).where(and(eq(event.id, eventId), eq(event.companyId, companyId), eq(event.status, "DRAFT")));
  redirect(`/company/${companyId}`);
}

export async function deleteEvent(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  await requireCompanyMembership(companyId);
  await db.delete(event).where(and(eq(event.id, eventId), eq(event.companyId, companyId), eq(event.status, "DRAFT")));
  redirect(`/company/${companyId}`);
}

const badgeTypes = ["CONTENT", "TALK", "STAND"] as const;
const badgeRarities = ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const;

async function companyEvent(companyId: string, eventId: string, draftOnly = false) {
  await requireCompanyMembership(companyId);
  const [row] = await db.select({ id: event.id, status: event.status }).from(event).where(and(eq(event.id, eventId), eq(event.companyId, companyId)));
  if (!row) throw new Error("El evento no existe.");
  if (draftOnly && row.status !== "DRAFT") throw new Error("Solo se pueden modificar badges de eventos en borrador.");
  return row;
}

function badgeInput(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim() || null;
  const type = String(formData.get("type") ?? "");
  const rarity = String(formData.get("rarity") ?? "");
  const icon = String(formData.get("icon") ?? "").trim() || null;
  const xp = Number(formData.get("xp"));
  const required = formData.get("required") === "on";

  if (!name || name.length > 120) throw new Error("El nombre del badge debe tener entre 1 y 120 caracteres.");
  if (!badgeTypes.includes(type as (typeof badgeTypes)[number])) throw new Error("El tipo de badge no es válido.");
  if (!badgeRarities.includes(rarity as (typeof badgeRarities)[number])) throw new Error("La rareza del badge no es válida.");
  if (!Number.isInteger(xp) || xp < 0 || xp > 100000) throw new Error("La XP debe ser un entero entre 0 y 100000.");
  return { name, description, type, rarity, icon, xp, required };
}

export async function listEventBadges(companyId: string, eventId: string) {
  await companyEvent(companyId, eventId);
  return db.select().from(badge).where(eq(badge.eventId, eventId)).orderBy(asc(badge.name));
}

export async function createBadge(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  await companyEvent(companyId, eventId, true);
  try {
    await db.insert(badge).values({ id: randomUUID(), eventId, ...badgeInput(formData) });
  } catch (error) {
    const cause = error as { code?: string; cause?: { code?: string } };
    if (cause.code === "23505" || cause.cause?.code === "23505") throw new Error("Ya existe un badge con ese nombre en este evento.");
    throw error;
  }
  redirect(`/company/${companyId}`);
}

export async function updateBadge(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const badgeId = String(formData.get("badgeId") ?? "");
  await companyEvent(companyId, eventId, true);
  const input = badgeInput(formData);
  const [updated] = await db.update(badge).set({ ...input, updatedAt: new Date() }).where(and(eq(badge.id, badgeId), eq(badge.eventId, eventId))).returning({ id: badge.id });
  if (!updated) throw new Error("El badge no existe.");
  redirect(`/company/${companyId}`);
}

export async function deleteBadge(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  const eventId = String(formData.get("eventId") ?? "");
  const badgeId = String(formData.get("badgeId") ?? "");
  await companyEvent(companyId, eventId, true);
  await db.delete(badge).where(and(eq(badge.id, badgeId), eq(badge.eventId, eventId)));
  redirect(`/company/${companyId}`);
}
