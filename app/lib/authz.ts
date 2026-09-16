import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { auth } from "@/app/lib/auth";
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
 * Panel de empresa: sesión + fila en company_member para esa empresa.
 * SUPER_ADMIN no entra por acá; su superficie es /admin.
 */
export async function requireCompanyMembership(companyId: string) {
  const session = await requireSession();

  if (await hasCompanyMembership(session.user.id, companyId)) {
    return session;
  }

  redirect(DENIED);
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
