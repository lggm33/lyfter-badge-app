"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { auditActorName, recordAudit } from "@/app/lib/audit";
import { requireRole } from "@/app/lib/authz";
import { user } from "@/auth-schema";
import { db } from "@/db";

export async function setUserDisabled(formData: FormData) {
  const session = await requireRole("SUPER_ADMIN");
  const userId = String(formData.get("userId") ?? "");
  const disable = formData.get("disabled") === "1";
  const search = String(formData.get("q") ?? "");
  const page = String(formData.get("page") ?? "");

  if (userId && userId !== session.user.id) {
    await db.transaction(async (tx) => {
      const [current] = await tx.select({ id: user.id, name: user.name }).from(user).where(eq(user.id, userId));
      if (!current) return;
      await tx.update(user).set({ disabledAt: disable ? new Date() : null }).where(eq(user.id, userId));
      await recordAudit(tx, {
        actorId: session.user.id,
        actorName: auditActorName(session.user),
        action: disable ? "user.disabled" : "user.enabled",
        resourceType: "user",
        resourceId: current.id,
        metadata: { userName: current.name },
      });
    });
  }

  redirect(directoryHref(search, Number(page)));
}

function directoryHref(search: string, page: number) {
  const query = new URLSearchParams();
  if (search) query.set("q", search);
  if (Number.isFinite(page) && page > 1) query.set("page", String(page));
  const value = query.toString();
  return value ? `/admin/users?${value}` : "/admin/users";
}
