"use server";

import { asc, and, eq, lte } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { requireCompanyMembership } from "@/app/lib/authz";
import { db } from "@/db";
import { badge, company, event } from "@/db/schema";

/** Se autoprotege: hace falta sesión y membresía de esa empresa. */
export async function getMyCompany(companyId: string) {
  await requireCompanyMembership(companyId);
  const [row] = await db.select().from(company).where(eq(company.id, companyId));
  return row;
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
