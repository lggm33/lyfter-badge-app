"use server";

import { randomUUID } from "node:crypto";
import { asc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireRole } from "@/app/lib/authz";
import { db } from "@/db";
import { company } from "@/db/schema";

export async function createCompany(formData: FormData) {
  await requireRole("SUPER_ADMIN");

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();

  if (!name || name.length > 120) {
    throw new Error("El nombre debe tener entre 1 y 120 caracteres.");
  }

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 80) {
    throw new Error("El slug solo puede usar minúsculas, números y guiones.");
  }

  try {
    await db.insert(company).values({ id: randomUUID(), name, slug });
  } catch (error) {
    const cause = error as { code?: string; cause?: { code?: string } };
    if (cause.code === "23505" || cause.cause?.code === "23505") {
      throw new Error("Ya existe una empresa con ese slug.");
    }
    throw error;
  }

  redirect("/admin/companies");
}

export async function listCompanies() {
  await requireRole("SUPER_ADMIN");
  return db.select().from(company).orderBy(asc(company.name));
}
