"use server";

import { asc, and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { requireCompanyMembership } from "@/app/lib/authz";
import { db } from "@/db";
import { company, event } from "@/db/schema";

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

  return { name, slug, description: String(formData.get("description") ?? "").trim() || null, location: String(formData.get("location") ?? "").trim() || null, startsAt, endsAt };
}

export async function listMyCompanyEvents(companyId: string) {
  await requireCompanyMembership(companyId);
  return db.select().from(event).where(eq(event.companyId, companyId)).orderBy(asc(event.startsAt));
}

export async function createEvent(formData: FormData) {
  const companyId = String(formData.get("companyId") ?? "");
  await requireCompanyMembership(companyId);
  const input = eventInput(formData);
  try {
    await db.insert(event).values({ id: randomUUID(), companyId, ...input });
  } catch (error) {
    const cause = error as { code?: string; cause?: { code?: string } };
    if (cause.code === "23505" || cause.cause?.code === "23505") throw new Error("Ya existe un evento con ese slug en esta empresa.");
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
