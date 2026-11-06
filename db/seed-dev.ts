import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { and, eq } from "drizzle-orm";
import { auth } from "@/app/lib/auth";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { assertLocalDatabase } from "@/db/local-only";
import {
  badge,
  badgeRedemption,
  company,
  companyMember,
  event,
  eventMembership,
  xpLedger,
} from "@/db/schema";
import { dropSession } from "@/db/seed";

// Dev-only credentials: assertLocalDatabase keeps them off any shared database.
export const DEV_PASSWORD = "lyfter-dev-1234";
export const DEV_ADMIN_EMAIL = "admin@demo.test";
export const DEV_PARTICIPANT_EMAIL = "participante@demo.test";

const BADGES = [
  { name: "Bienvenida", type: "CONTENT", rarity: "COMMON", icon: "🤝", xp: 50, redeemed: true },
  { name: "Charla de apertura", type: "TALK", rarity: "RARE", icon: "🎤", xp: 100, redeemed: true },
  // Scanning this one takes the participant from 150 to 200 XP: level-up notice.
  { name: "Stand de datos", type: "STAND", rarity: "EPIC", icon: "💡", xp: 50, redeemed: false },
  { name: "Charla de cierre", type: "TALK", rarity: "LEGENDARY", icon: "🚀", xp: 250, redeemed: false },
] as const;

async function ensureUser(email: string, name: string) {
  const [existing] = await db.select({ id: user.id }).from(user).where(eq(user.email, email));
  if (existing) return existing.id;

  const created = await auth.api.signUpEmail({ body: { email, name, password: DEV_PASSWORD } });
  await dropSession(created.token);
  return created.user.id;
}

/** Inserts the event or moves its status and dates, so every run leaves it in the state the seed describes. */
async function upsertEvent(
  companyId: string,
  slug: string,
  values: { name: string; status: string; startsAt: Date; endsAt: Date; description?: string; location?: string },
) {
  const { status, startsAt, endsAt } = values;
  await db
    .insert(event)
    .values({ id: randomUUID(), companyId, slug, ...values })
    .onConflictDoUpdate({ target: [event.companyId, event.slug], set: { status, startsAt, endsAt } });
  const [{ id }] = await db
    .select({ id: event.id })
    .from(event)
    .where(and(eq(event.companyId, companyId), eq(event.slug, slug)));
  return id;
}

/**
 * Idempotent. Re-running reopens the event for 30 more days, so the demo data
 * never goes stale; redemptions and XP are only written once.
 */
export async function seedDev() {
  assertLocalDatabase(process.env.DATABASE_URL);

  const adminId = await ensureUser(DEV_ADMIN_EMAIL, "Admin Demo");
  const participantId = await ensureUser(DEV_PARTICIPANT_EMAIL, "Participante Demo");

  await db
    .insert(company)
    .values({ id: randomUUID(), name: "Lyfter Demo", slug: "lyfter-demo" })
    .onConflictDoNothing();
  const [{ id: companyId }] = await db
    .select({ id: company.id })
    .from(company)
    .where(eq(company.slug, "lyfter-demo"));

  await db
    .insert(companyMember)
    .values({ id: randomUUID(), companyId, userId: adminId, role: "COMPANY_ADMIN" })
    .onConflictDoNothing();

  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const eventId = await upsertEvent(companyId, "demo-day", {
    name: "Demo Day",
    description: "Evento de prueba para desarrollo local.",
    location: "Sala principal",
    status: "ACTIVE",
    startsAt: new Date(now - 60 * 60 * 1000),
    endsAt: new Date(now + 30 * day),
  });
  // One event per remaining state, so the panel shows all three without editing the database by hand.
  const extraEvents = [
    { slug: "hackathon", name: "Hackathon", status: "DRAFT", startsAt: new Date(now + 20 * day), endsAt: new Date(now + 21 * day), badge: "Demo final" },
    { slug: "kickoff", name: "Kickoff", status: "FINISHED", startsAt: new Date(now - 60 * day), endsAt: new Date(now - 59 * day), badge: "Bienvenida Kickoff" },
  ];
  for (const { slug, badge: badgeName, ...values } of extraEvents) {
    const id = await upsertEvent(companyId, slug, values);
    await db
      .insert(badge)
      .values({ id: randomUUID(), eventId: id, name: badgeName, type: "CONTENT", rarity: "COMMON", icon: "⭐", xp: 50 })
      .onConflictDoNothing();
  }

  await db
    .insert(eventMembership)
    .values({ id: randomUUID(), eventId, userId: participantId })
    .onConflictDoNothing();

  for (const { redeemed, ...values } of BADGES) {
    await db
      .insert(badge)
      .values({ id: randomUUID(), eventId, required: values.rarity !== "LEGENDARY", ...values })
      .onConflictDoNothing();
    if (!redeemed) continue;

    const [{ id: badgeId }] = await db
      .select({ id: badge.id })
      .from(badge)
      .where(and(eq(badge.eventId, eventId), eq(badge.name, values.name)));
    await db.transaction(async (tx) => {
      const [redemption] = await tx
        .insert(badgeRedemption)
        .values({ id: randomUUID(), badgeId, eventId, userId: participantId })
        .onConflictDoNothing()
        .returning({ id: badgeRedemption.id });
      if (redemption) {
        await tx.insert(xpLedger).values({
          id: randomUUID(),
          redemptionId: redemption.id,
          userId: participantId,
          amount: values.xp,
        });
      }
    });
  }

  return { companyId, eventId };
}

async function main() {
  const { companyId, eventId } = await seedDev();
  console.log(`Seed de dev listo. Contraseña de ambas cuentas: ${DEV_PASSWORD}
  Company admin: ${DEV_ADMIN_EMAIL} → /company/${companyId}
  Participante:  ${DEV_PARTICIPANT_EMAIL} → /home (150 XP, nivel 2)
  QR del evento: /company/${companyId}/events/${eventId}/qr`);
  await db.$client.end();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
