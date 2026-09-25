"use server";

import { asc, desc, eq, sum } from "drizzle-orm";
import { requireSession } from "@/app/lib/authz";
import { db } from "@/db";
import { badge, badgeRedemption, company, companyMember, event, xpLedger } from "@/db/schema";

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

export async function listMyCollection() {
  const session = await requireSession();
  const userId = session.user.id;

  const [totalRow] = await db
    .select({ total: sum(xpLedger.amount) })
    .from(xpLedger)
    .where(eq(xpLedger.userId, userId));

  const badges = await db
    .select({
      redemptionId: badgeRedemption.id,
      name: badge.name,
      icon: badge.icon,
      eventName: event.name,
      xp: xpLedger.amount,
      redeemedAt: badgeRedemption.createdAt,
    })
    .from(badgeRedemption)
    .innerJoin(badge, eq(badgeRedemption.badgeId, badge.id))
    .innerJoin(event, eq(badgeRedemption.eventId, event.id))
    .innerJoin(xpLedger, eq(xpLedger.redemptionId, badgeRedemption.id))
    .where(eq(badgeRedemption.userId, userId))
    .orderBy(desc(badgeRedemption.createdAt));

  return {
    totalXp: Number(totalRow?.total ?? 0),
    badges,
  };
}
