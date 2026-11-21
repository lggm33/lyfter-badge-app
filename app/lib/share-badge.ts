import { eq } from "drizzle-orm";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { badge, badgeRedemption, event } from "@/db/schema";

export type ShareCard = {
  name: string;
  badgeName: string;
  icon: string | null;
  eventName: string;
  xp: number;
};

export async function loadShareCard(redemptionId: string): Promise<ShareCard | null> {
  const [row] = await db
    .select({
      name: user.name,
      badgeName: badge.name,
      icon: badge.icon,
      eventName: event.name,
      xp: badge.xp,
    })
    .from(badgeRedemption)
    .innerJoin(badge, eq(badgeRedemption.badgeId, badge.id))
    .innerJoin(event, eq(badgeRedemption.eventId, event.id))
    .innerJoin(user, eq(badgeRedemption.userId, user.id))
    .where(eq(badgeRedemption.id, redemptionId));

  if (!row) return null;
  return row;
}

export function shareCardUrl(redemptionId: string) {
  const base = (process.env.BETTER_AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/share/${redemptionId}`;
}

export function shareCardDetail(card: Pick<ShareCard, "badgeName" | "xp">) {
  return `obtuvo ${card.badgeName} y ${card.xp} XP.`;
}

export function shareCardText(card: ShareCard) {
  return `${card.name} ${shareCardDetail(card)}`;
}
