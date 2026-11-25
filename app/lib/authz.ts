import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/app/lib/auth";
import { isUserDisabled } from "@/app/lib/user-status";
import { readRequestImpersonation } from "@/app/lib/impersonation";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { companyMember } from "@/db/schema";

export type GlobalRole = "SUPER_ADMIN" | "PARTICIPANT";

const DENIED = "/home";

export async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    redirect("/login");
  }

  if (await isUserDisabled(session.user.id)) {
    redirect("/logout-disabled");
  }

  return session;
}

/**
 * El rol global vive en `user.role` y no viaja en la sesión (`returned: false`),
 * así que se lee siempre de la DB. Un valor desconocido degrada a PARTICIPANT.
 */
export async function getGlobalRole(userId: string): Promise<GlobalRole> {
  const [row] = await db
    .select({ role: user.role })
    .from(user)
    .where(eq(user.id, userId));

  return row?.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "PARTICIPANT";
}

/** Coincidencia exacta: SUPER_ADMIN y PARTICIPANT son alcances, no una jerarquía. */
export async function requireRole(role: GlobalRole) {
  const session = await requireSession();

  if ((await getGlobalRole(session.user.id)) !== role) {
    redirect(DENIED);
  }

  return session;
}

async function hasCompanyMembership(userId: string, companyId: string) {
  const [membership] = await db
    .select({ id: companyMember.id })
    .from(companyMember)
    .where(
      and(
        eq(companyMember.companyId, companyId),
        eq(companyMember.userId, userId),
      ),
    );

  return Boolean(membership);
}

/**
 * Panel de empresa: sesión y fila en company_member, o una cookie de
 * impersonación válida del Super Admin. Sin esa cookie, SUPER_ADMIN no entra.
 */
export async function requireCompanyMembership(companyId: string) {
  const session = await requireSession();

  if (await hasCompanyMembership(session.user.id, companyId)) {
    return session;
  }

  if (await isImpersonatingCompany(session.user.id, companyId)) {
    return session;
  }

  redirect(DENIED);
}

/**
 * True only when the signed cookie names this user and this company, the role
 * is still SUPER_ADMIN, and there is no membership to enter through instead.
 */
export async function isImpersonatingCompany(userId: string, companyId: string) {
  const payload = await readRequestImpersonation();
  if (!payload || payload.actorId !== userId || payload.companyId !== companyId) {
    return false;
  }

  if ((await getGlobalRole(userId)) !== "SUPER_ADMIN") {
    return false;
  }

  return !(await hasCompanyMembership(userId, companyId));
}

/** SUPER_ADMIN entra a cualquier empresa; el resto necesita fila en company_member. */
export async function requireCompanyAccess(companyId: string) {
  const session = await requireSession();

  if ((await getGlobalRole(session.user.id)) === "SUPER_ADMIN") {
    return session;
  }

  if (await hasCompanyMembership(session.user.id, companyId)) {
    return session;
  }

  redirect(DENIED);
}
