"use server";

import { eq } from "drizzle-orm";
import { requireCompanyMembership } from "@/app/lib/authz";
import { db } from "@/db";
import { company } from "@/db/schema";

/** Se autoprotege: hace falta sesión y membresía de esa empresa. */
export async function getMyCompany(companyId: string) {
  await requireCompanyMembership(companyId);
  const [row] = await db.select().from(company).where(eq(company.id, companyId));
  return row;
}
