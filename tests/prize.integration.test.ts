import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const headersMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn((path: string): never => { throw new Error(`REDIRECT:${path}`); }));
vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import { activateEvent, savePrize } from "@/app/(protected)/company/[companyId]/actions";
import { claimPrize, listMyCollection } from "@/app/(protected)/home/actions";
import { getEventRewards } from "@/app/lib/rewards";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { badge, company, companyMember, event, eventCompletion, eventMembership } from "@/db/schema";
import { cookieHeader, postAuth, requireTestEnv, uniqueEmail } from "./helpers";

const password = "integration-test-password";
const emails = {
  admin: uniqueEmail("prize-admin"),
  otherAdmin: uniqueEmail("prize-other-admin"),
  winner: uniqueEmail("prize-winner"),
  bystander: uniqueEmail("prize-bystander"),
};
const companyId = randomUUID();
const otherCompanyId = randomUUID();
const hour = 60 * 60 * 1000;

const ids = {} as Record<keyof typeof emails, string>;
const cookies = {} as Record<keyof typeof emails, string>;

function form(values: Record<string, string>) {
  const result = new FormData();
  Object.entries(values).forEach(([key, value]) => result.set(key, value));
  return result;
}

function as(who: keyof typeof emails) {
  headersMock.mockResolvedValueOnce(new Headers({ cookie: cookies[who] }));
}

async function createEvent(values: Partial<typeof event.$inferInsert> = {}, { required = true } = {}) {
  const eventId = randomUUID();
  await db.insert(event).values({
    id: eventId,
    companyId,
    name: "Prize Day",
    slug: `prize-${eventId}`,
    startsAt: new Date(Date.now() - hour),
    endsAt: new Date(Date.now() + hour),
    status: "ACTIVE",
    ...values,
  });
  await db.insert(badge).values({ id: randomUUID(), eventId, name: "Entry", type: "CONTENT", rarity: "COMMON", xp: 50, required });
  return eventId;
}

async function complete(eventId: string, who: keyof typeof emails) {
  await db.insert(eventCompletion).values({ id: randomUUID(), eventId, userId: ids[who] });
}

const prize = { prizeTitle: "Sticker pack", prizeDescription: "Código SECRET-123" };

describe("general prize", () => {
  beforeAll(async () => {
    requireTestEnv();
    for (const key of Object.keys(emails) as (keyof typeof emails)[]) {
      const signUp = await postAuth("/sign-up/email", { name: key, email: emails[key], password });
      expect(signUp.status).toBe(200);
      ids[key] = (await signUp.json()).user.id;
      cookies[key] = cookieHeader(await postAuth("/sign-in/email", { email: emails[key], password }));
    }
    await db.insert(company).values([
      { id: companyId, name: "Prize Co", slug: `prize-${companyId}` },
      { id: otherCompanyId, name: "Other Prize Co", slug: `prize-${otherCompanyId}` },
    ]);
    await db.insert(companyMember).values([
      { id: randomUUID(), companyId, userId: ids.admin, role: "COMPANY_ADMIN" },
      { id: randomUUID(), companyId: otherCompanyId, userId: ids.otherAdmin, role: "COMPANY_ADMIN" },
    ]);
  });

  afterAll(async () => {
    await db.delete(company).where(eq(company.id, companyId));
    await db.delete(company).where(eq(company.id, otherCompanyId));
    for (const email of Object.values(emails)) await db.delete(user).where(eq(user.email, email));
  });

  describe("rewards", () => {
    it("hides the prize content until the user has a completion", async () => {
      const eventId = await createEvent(prize);
      await complete(eventId, "winner");

      const locked = await getEventRewards(ids.bystander, [eventId]);
      const revealed = await getEventRewards(ids.winner, [eventId]);

      expect(locked.get(eventId)).toEqual({ prize: { status: "locked" }, raffle: null });
      expect(JSON.stringify(locked)).not.toContain("Sticker");
      expect(JSON.stringify(locked)).not.toContain("SECRET");
      expect(revealed.get(eventId)).toEqual({
        prize: { status: "revealed", title: "Sticker pack", description: "Código SECRET-123" },
        raffle: null,
      });
    });

    it("reports no prize for an event without one", async () => {
      const eventId = await createEvent();
      await complete(eventId, "winner");

      await expect(getEventRewards(ids.winner, [eventId])).resolves.toEqual(new Map([[eventId, { prize: null, raffle: null }]]));
    });

    it("feeds /badges with the locked state for a participant who has not completed", async () => {
      const eventId = await createEvent(prize);
      await complete(eventId, "winner");
      await db.insert(eventMembership).values({ id: randomUUID(), eventId, userId: ids.bystander });

      as("bystander");
      const collection = await listMyCollection();
      const mine = collection.events.find((item) => item.eventId === eventId);

      expect(mine?.prize).toEqual({ status: "locked" });
      expect(JSON.stringify(collection)).not.toContain("Sticker");
    });
  });

  describe("claiming", () => {
    it("claims once and leaves claimed_at alone the second time", async () => {
      const eventId = await createEvent(prize);
      await complete(eventId, "winner");
      await complete(eventId, "bystander");

      as("winner");
      await claimPrize(eventId);
      const firstClaim = (await db.select().from(eventCompletion).where(eq(eventCompletion.eventId, eventId))).find((row) => row.userId === ids.winner);
      as("winner");
      await claimPrize(eventId);
      const rows = await db.select().from(eventCompletion).where(eq(eventCompletion.eventId, eventId));
      const winner = rows.find((row) => row.userId === ids.winner);
      const bystander = rows.find((row) => row.userId === ids.bystander);

      expect(firstClaim?.claimedAt).toBeInstanceOf(Date);
      expect(winner?.claimedAt).toEqual(firstClaim?.claimedAt);
      expect(bystander?.claimedAt).toBeNull();
      await expect(getEventRewards(ids.winner, [eventId])).resolves.toEqual(
        new Map([[eventId, { prize: expect.objectContaining({ status: "claimed", claimedAt: firstClaim?.claimedAt }), raffle: null }]]),
      );
    });

    it("refuses to claim without a completion", async () => {
      const eventId = await createEvent(prize);

      as("bystander");
      await expect(claimPrize(eventId)).rejects.toThrow("Todavía no completaste este evento.");
    });

    it("refuses to claim an event without a prize", async () => {
      const eventId = await createEvent();
      await complete(eventId, "winner");

      as("winner");
      await expect(claimPrize(eventId)).rejects.toThrow("Este evento no tiene premio.");
      await expect(db.select().from(eventCompletion).where(eq(eventCompletion.eventId, eventId))).resolves.toEqual([
        expect.objectContaining({ claimedAt: null }),
      ]);
    });
  });

  describe("editing", () => {
    const fields = (eventId: string, values: Record<string, string> = {}) =>
      form({ companyId, eventId, prizeTitle: "Camiseta", prizeDescription: "Talle único", ...values });

    it("saves, updates and removes the prize while the event is open", async () => {
      const eventId = await createEvent();

      as("admin");
      await expect(savePrize(fields(eventId))).rejects.toThrow(`REDIRECT:/company/${companyId}`);
      await expect(db.select({ title: event.prizeTitle, description: event.prizeDescription }).from(event).where(eq(event.id, eventId))).resolves.toEqual([
        { title: "Camiseta", description: "Talle único" },
      ]);

      as("admin");
      await expect(savePrize(fields(eventId, { prizeTitle: "", prizeDescription: "ignorada" }))).rejects.toThrow(`REDIRECT:/company/${companyId}`);
      await expect(db.select({ title: event.prizeTitle, description: event.prizeDescription }).from(event).where(eq(event.id, eventId))).resolves.toEqual([
        { title: null, description: null },
      ]);
    });

    it("rejects edits on a finished event and on an active one already past its end", async () => {
      const finished = await createEvent({ status: "FINISHED", endsAt: new Date(Date.now() - hour), startsAt: new Date(Date.now() - 2 * hour) });
      const expired = await createEvent({ status: "ACTIVE", endsAt: new Date(Date.now() - hour), startsAt: new Date(Date.now() - 2 * hour) });

      for (const eventId of [finished, expired]) {
        as("admin");
        await expect(savePrize(fields(eventId))).resolves.toEqual({ error: "No se puede editar el premio de un evento cerrado." });
        await expect(db.select({ title: event.prizeTitle }).from(event).where(eq(event.id, eventId))).resolves.toEqual([{ title: null }]);
      }
    });

    it("rejects a prize when the event has no required badge", async () => {
      const eventId = await createEvent({}, { required: false });

      as("admin");
      await expect(savePrize(fields(eventId))).resolves.toEqual({ error: "Agregá al menos un badge requerido antes de guardar un premio." });
    });

    it("rejects the admin of another company without touching the event", async () => {
      const eventId = await createEvent();

      as("otherAdmin");
      await expect(savePrize(fields(eventId))).rejects.toThrow("REDIRECT:/home");
      // Even with the right access, an event id from another company is not editable through a foreign companyId.
      as("otherAdmin");
      await expect(savePrize(form({ companyId: otherCompanyId, eventId, prizeTitle: "Robado" }))).resolves.toEqual({ error: "El evento no existe." });
      await expect(db.select({ title: event.prizeTitle }).from(event).where(eq(event.id, eventId))).resolves.toEqual([{ title: null }]);
    });
  });

  describe("activation", () => {
    const draft = (values: Partial<typeof event.$inferInsert> = {}, required = true) =>
      createEvent({ status: "DRAFT", startsAt: new Date(Date.now() + hour), endsAt: new Date(Date.now() + 2 * hour), ...values }, { required });

    it("refuses to activate an event with a prize and no required badge", async () => {
      const eventId = await draft(prize, false);

      as("admin");
      await expect(activateEvent(form({ companyId, eventId }))).rejects.toThrow("necesita al menos un badge requerido");
      await expect(db.select({ status: event.status }).from(event).where(eq(event.id, eventId))).resolves.toEqual([{ status: "DRAFT" }]);
    });

    it("activates an event with a prize once a badge is required, and one without a prize with optional badges only", async () => {
      const withPrize = await draft(prize, true);
      const withoutPrize = await draft({}, false);

      as("admin");
      await expect(activateEvent(form({ companyId, eventId: withPrize }))).rejects.toThrow(`REDIRECT:/company/${companyId}`);
      as("admin");
      await expect(activateEvent(form({ companyId, eventId: withoutPrize }))).rejects.toThrow(`REDIRECT:/company/${companyId}`);
      await expect(db.select({ status: event.status }).from(event).where(eq(event.id, withPrize))).resolves.toEqual([{ status: "ACTIVE" }]);
      await expect(db.select({ status: event.status }).from(event).where(eq(event.id, withoutPrize))).resolves.toEqual([{ status: "ACTIVE" }]);
    });
  });
});
