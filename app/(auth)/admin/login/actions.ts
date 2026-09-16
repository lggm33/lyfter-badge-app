"use server";

import { headers } from "next/headers";
import { auth } from "@/app/lib/auth";
import { getGlobalRole } from "@/app/lib/authz";

export async function isSuperAdmin() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session ? (await getGlobalRole(session.user.id)) === "SUPER_ADMIN" : false;
}
