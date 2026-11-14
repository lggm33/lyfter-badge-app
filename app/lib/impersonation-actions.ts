"use server";

import { and, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { auditActorName, recordAudit } from "@/app/lib/audit";
import { requireRole } from "@/app/lib/authz";
import {
  IMPERSONATION_TTL_MS,
  clearImpersonationCookie,
  readRequestImpersonation,
  signImpersonation,
  writeImpersonationCookie,
} from "@/app/lib/impersonation";
import { db } from "@/db";
import { company, companyMember } from "@/db/schema";

/** Opens the company panel for a Super Admin who is not already a member. */
export async function startImpersonation(formData: FormData) {
  const session = await requireRole("SUPER_ADMIN");
  const companyId = String(formData.get("companyId") ?? "");
  const [current] = await db.select({ id: company.id }).from(company).where(eq(company.id, companyId));
  if (!current) notFound();

  if (await isCompanyMember(session.user.id, companyId)) {
    redirect(`/company/${companyId}`);
  }

  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET is not set");

  const exp = Date.now() + IMPERSONATION_TTL_MS;
  await writeImpersonationCookie(
    signImpersonation({ companyId, actorId: session.user.id, exp }, secret),
    exp,
  );
  await db.transaction(async (tx) => {
    await recordAudit(tx, {
      actorId: session.user.id,
      actorName: auditActorName(session.user),
      action: "impersonation.started",
      companyId,
      resourceType: "impersonation",
      resourceId: companyId,
      metadata: { companyId },
    });
  });
  redirect(`/company/${companyId}`);
}

/** Drops the cookie and records the exit. The session itself does not change. */
export async function stopImpersonation() {
  const session = await requireRole("SUPER_ADMIN");
  const payload = await readRequestImpersonation();
  await clearImpersonationCookie();

  if (payload && payload.actorId === session.user.id) {
    await db.transaction(async (tx) => {
      await recordAudit(tx, {
        actorId: session.user.id,
        actorName: auditActorName(session.user),
        action: "impersonation.stopped",
        companyId: payload.companyId,
        resourceType: "impersonation",
        resourceId: payload.companyId,
        metadata: { companyId: payload.companyId },
      });
    });
    redirect(`/admin/companies/${payload.companyId}`);
  }

  redirect("/admin/companies");
}

async function isCompanyMember(userId: string, companyId: string) {
  const [row] = await db
    .select({ id: companyMember.id })
    .from(companyMember)
    .where(and(eq(companyMember.companyId, companyId), eq(companyMember.userId, userId)));
  return Boolean(row);
}
