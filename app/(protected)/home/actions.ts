"use server";

import { asc, eq } from "drizzle-orm";
import { requireSession } from "@/app/lib/authz";
import { db } from "@/db";
import { company, companyMember } from "@/db/schema";

export async function listMyCompanies() {
  const session = await requireSession();

  return db
    .select({
      id: company.id,
      name: company.name,
    })
    .from(companyMember)
    .innerJoin(company, eq(companyMember.companyId, company.id))
    .where(eq(companyMember.userId, session.user.id))
    .orderBy(asc(company.name));
}
