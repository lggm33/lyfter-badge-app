"use server";

import { randomUUID } from "node:crypto";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { requireRole } from "@/app/lib/authz";
import { USER_SEARCH_LIMIT, buildUserSearchPattern } from "@/app/lib/user-search";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { company, companyMember } from "@/db/schema";

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

export async function getCompany(companyId: string) {
  await requireRole("SUPER_ADMIN");
  const [row] = await db.select().from(company).where(eq(company.id, companyId));
  return row;
}

export async function listCompanyMembers(companyId: string) {
  await requireRole("SUPER_ADMIN");

  return db
    .select({
      id: companyMember.id,
      userId: companyMember.userId,
      name: user.name,
      email: user.email,
      role: companyMember.role,
    })
    .from(companyMember)
    .innerJoin(user, eq(companyMember.userId, user.id))
    .where(eq(companyMember.companyId, companyId))
    .orderBy(asc(user.email));
}

export type AssignableUser = {
  id: string;
  name: string;
  email: string;
  alreadyAdmin: boolean;
};

export async function searchAssignableUsers(query: string, companyId: string) {
  await requireRole("SUPER_ADMIN");

  const pattern = buildUserSearchPattern(query);
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      membershipId: companyMember.id,
    })
    .from(user)
    .leftJoin(
      companyMember,
      and(
        eq(companyMember.userId, user.id),
        eq(companyMember.companyId, companyId),
      ),
    )
    .where(
      pattern
        ? or(
            sql`${user.name} ILIKE ${pattern} ESCAPE '\\'`,
            sql`${user.email} ILIKE ${pattern} ESCAPE '\\'`,
          )
        : sql`TRUE`,
    )
    .orderBy(sql`lower(${user.name})`)
    .limit(USER_SEARCH_LIMIT + 1);

  return {
    users: rows.slice(0, USER_SEARCH_LIMIT).map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      alreadyAdmin: Boolean(row.membershipId),
    })),
    hasMore: rows.length > USER_SEARCH_LIMIT,
  };
}

/**
 * Asigna un usuario **ya registrado**: no invita por email ni crea cuentas.
 * El rol global del usuario no cambia; COMPANY_ADMIN vive en la membresía.
 */
export async function assignCompanyAdmin(formData: FormData) {
  await requireRole("SUPER_ADMIN");

  const companyId = String(formData.get("companyId") ?? "");
  const userId = String(formData.get("userId") ?? "").trim();

  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId));

  if (!target) {
    throw new Error("No existe un usuario registrado con ese identificador.");
  }

  // Reasignar es idempotente: el unique (company_id, user_id) absorbe el reintento.
  await db
    .insert(companyMember)
    .values({
      id: randomUUID(),
      companyId,
      userId: target.id,
      role: "COMPANY_ADMIN",
    })
    .onConflictDoNothing();

  redirect(`/admin/companies/${companyId}`);
}

export async function removeCompanyMember(formData: FormData) {
  await requireRole("SUPER_ADMIN");

  const companyId = String(formData.get("companyId") ?? "");
  const memberId = String(formData.get("memberId") ?? "");

  await db.delete(companyMember).where(eq(companyMember.id, memberId));

  redirect(`/admin/companies/${companyId}`);
}
