import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { auth } from "@/app/lib/auth";
import { user } from "@/auth-schema";
import { db } from "@/db";

export async function isUserDisabled(userId: string) {
  const [row] = await db.select({ disabledAt: user.disabledAt }).from(user).where(eq(user.id, userId));
  return row?.disabledAt != null;
}

/** Clears the session when the account is disabled. Returns whether it did. */
export async function signOutIfDisabled(userId: string) {
  if (!(await isUserDisabled(userId))) return false;
  await auth.api.signOut({ headers: await headers() });
  return true;
}

export async function ensureActiveSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return "missing" as const;
  if (await signOutIfDisabled(session.user.id)) return "disabled" as const;
  return "ok" as const;
}
