import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const headersMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn((path: string): never => { throw new Error(`REDIRECT:${path}`); }));
vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));

import { deleteRafflePrize, drawRaffle, listEventRaffle, saveRafflePrize } from "@/app/(protected)/company/[companyId]/actions";
import { claimRaffleWin } from "@/app/(protected)/home/actions";
import { getEventRewards } from "@/app/lib/rewards";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { badge, company, companyMember, event, eventCompletion, rafflePrize, raffleWin } from "@/db/schema";
import { cookieHeader, postAuth, requireTestEnv, uniqueEmail } from "./helpers";

const password = "integration-test-password";
const emails = {
  admin: uniqueEmail("raffle-admin"),
  otherAdmin: uniqueEmail("raffle-other-admin"),
  one: uniqueEmail("raffle-one"),
  two: uniqueEmail("raffle-two"),
  three: uniqueEmail("raffle-three"),
  outsider: uniqueEmail("raffle-outsider"),
};
type Who = keyof typeof emails;
const companyId = randomUUID();
const otherCompanyId = randomUUID();
const hour = 60 * 60 * 1000;
const completers: Who[] = ["one", "two", "three"];

const ids = {} as Record<Who, string>;
const cookies = {} as Record<Who, string>;

function form(values: Record<string, string>) {
  const result = new FormData();
  Object.entries(values).forEach(([key, value]) => result.set(key, value));
  return result;
}

function as(who: Who) {
  headersMock.mockResolvedValueOnce(new Headers({ cookie: cookies[who] }));
}

/** An event that already ended (so it can be drawn) with one required badge. */
async function endedEvent(values: Partial<typeof event.$inferInsert> = {}) {
  const eventId = randomUUID();
  await db.insert(event).values({
    id: eventId,
    companyId,
    name: "Raffle Day",
    slug: `raffle-${eventId}`,
    startsAt: new Date(Date.now() - 3 * hour),
    endsAt: new Date(Date.now() - hour),
    status: "FINISHED",
    ...values,
  });
  await db.insert(badge).values({ id: randomUUID(), eventId, name: "Entry", type: "CONTENT", rarity: "COMMON", xp: 50, required: true });
  return eventId;
}

async function addPrize(eventId: string, title: string, quantity: number) {
  const id = randomUUID();
  await db.insert(rafflePrize).values({ id, eventId, title, description: `Detalle ${title}`, quantity });
  return id;
}

async function complete(eventId: string, who: Who[]) {
  await db.insert(eventCompletion).values(who.map((key) => ({ id: randomUUID(), eventId, userId: ids[key] })));
}

const draw = (eventId: string, values: Record<string, string> = {}) => drawRaffle(form({ companyId, eventId, ...values }));
const wins = (eventId: string) => db.select().from(raffleWin).where(eq(raffleWin.eventId, eventId));
const drawnAt = async (eventId: string) => (await db.select({ at: event.raffleDrawnAt }).from(event).where(eq(event.id, eventId)))[0].at;

describe("raffle", () => {
  beforeAll(async () => {
    requireTestEnv();
    for (const key of Object.keys(emails) as Who[]) {
      const signUp = await postAuth("/sign-up/email", { name: key, email: emails[key], password });
      expect(signUp.status).toBe(200);
      ids[key] = (await signUp.json()).user.id;
      cookies[key] = cookieHeader(await postAuth("/sign-in/email", { email: emails[key], password }));
    }
    await db.insert(company).values([
      { id: companyId, name: "Raffle Co", slug: `raffle-${companyId}` },
      { id: otherCompanyId, name: "Other Raffle Co", slug: `raffle-${otherCompanyId}` },
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

  describe("drawing", () => {
    it("does not draw before the event ends", async () => {
      const eventId = await endedEvent({ status: "ACTIVE", endsAt: new Date(Date.now() + hour) });
      await addPrize(eventId, "Entrada", 1);
      await complete(eventId, ["one"]);

      as("admin");
      await expect(draw(eventId)).resolves.toEqual({ error: "La rifa se puede sortear cuando termina el evento." });
      await expect(drawnAt(eventId)).resolves.toBeNull();
      await expect(wins(eventId)).resolves.toHaveLength(0);
    });

    it("draws an ACTIVE event whose end time already passed", async () => {
      const eventId = await endedEvent({ status: "ACTIVE" });
      await addPrize(eventId, "Entrada", 1);
      await complete(eventId, ["one"]);

      as("admin");
      await expect(draw(eventId)).rejects.toThrow(`REDIRECT:/company/${companyId}`);
      await expect(wins(eventId)).resolves.toEqual([expect.objectContaining({ userId: ids.one })]);
    });

    it("refuses to draw without prizes", async () => {
      const eventId = await endedEvent();

      as("admin");
      await expect(draw(eventId)).resolves.toEqual({ error: "Cargá al menos un premio antes de sortear." });
      await expect(drawnAt(eventId)).resolves.toBeNull();
    });

    it("lets only one of two parallel draws assign", async () => {
      const eventId = await endedEvent();
      await addPrize(eventId, "Entrada", 1);
      await addPrize(eventId, "Taza", 1);
      await complete(eventId, completers);

      as("admin");
      as("admin");
      const results = await Promise.allSettled([draw(eventId), draw(eventId)]);

      const assigned = results.filter((result) => result.status === "rejected" && String(result.reason).includes("REDIRECT"));
      const refused = results.filter((result) => result.status === "fulfilled");
      expect(assigned).toHaveLength(1);
      expect(refused.map((result) => (result as PromiseFulfilledResult<unknown>).value)).toEqual([{ error: "La rifa ya se sorteó." }]);
      await expect(wins(eventId)).resolves.toHaveLength(2);
    });

    it("gives each person one prize, never to a non-completer, and leaves extra units unassigned", async () => {
      const eventId = await endedEvent();
      await addPrize(eventId, "Entrada", 3);
      await addPrize(eventId, "Taza", 3);
      await complete(eventId, completers);

      as("admin");
      await expect(draw(eventId)).rejects.toThrow(`REDIRECT:/company/${companyId}`);

      const result = await wins(eventId);
      expect(result.map((row) => row.userId).sort()).toEqual(completers.map((key) => ids[key]).sort());
      expect(result.map((row) => row.userId)).not.toContain(ids.outsider);
      as("admin");
      const panel = await listEventRaffle(companyId, eventId);
      expect(panel.prizes.reduce((total, prize) => total + prize.quantity, 0)).toBe(6);
      expect(panel.winners).toHaveLength(3);
    });

    it("assigns only as many units as there are prizes when participants exceed them", async () => {
      const eventId = await endedEvent();
      await addPrize(eventId, "Entrada", 2);
      await complete(eventId, completers);

      as("admin");
      await expect(draw(eventId)).rejects.toThrow(`REDIRECT:/company/${companyId}`);

      const result = await wins(eventId);
      expect(result).toHaveLength(2);
      expect(new Set(result.map((row) => row.userId)).size).toBe(2);
    });

    it("records the draw even when nobody completed the event", async () => {
      const eventId = await endedEvent();
      await addPrize(eventId, "Entrada", 2);

      as("admin");
      await expect(draw(eventId)).rejects.toThrow(`REDIRECT:/company/${companyId}`);

      await expect(drawnAt(eventId)).resolves.toBeInstanceOf(Date);
      await expect(wins(eventId)).resolves.toHaveLength(0);
      as("admin");
      await expect(draw(eventId)).resolves.toEqual({ error: "La rifa ya se sorteó." });
    });

    it("waits for a redemption in flight and includes the completion it commits", async () => {
      const eventId = await endedEvent();
      await addPrize(eventId, "Entrada", 1);

      let release!: () => void;
      const hold = new Promise<void>((resolve) => { release = resolve; });
      let locked!: () => void;
      const gotLock = new Promise<void>((resolve) => { locked = resolve; });
      // Same lock redeemBadge takes before it can insert a completion.
      const inFlight = db.transaction(async (tx) => {
        await tx.select({ id: event.id }).from(event).where(eq(event.id, eventId)).for("share");
        locked();
        await hold;
        await tx.insert(eventCompletion).values({ id: randomUUID(), eventId, userId: ids.one });
      });
      await gotLock;

      as("admin");
      const drawing = draw(eventId).catch((error: Error) => error);
      const early = await Promise.race([drawing.then(() => "finished"), new Promise((resolve) => setTimeout(() => resolve("blocked"), 300))]);
      release();
      await inFlight;
      await drawing;

      expect(early).toBe("blocked");
      await expect(wins(eventId)).resolves.toEqual([expect.objectContaining({ userId: ids.one })]);
    });
  });

  describe("editing", () => {
    const prizeFields = (eventId: string, values: Record<string, string> = {}) =>
      form({ companyId, eventId, raffleTitle: "Entrada", raffleDescription: "Válida", raffleQuantity: "2", ...values });

    it("creates, edits and deletes prizes while the raffle is undrawn", async () => {
      const eventId = await endedEvent();

      as("admin");
      await expect(saveRafflePrize(prizeFields(eventId))).rejects.toThrow(`REDIRECT:/company/${companyId}`);
      const [created] = await db.select().from(rafflePrize).where(eq(rafflePrize.eventId, eventId));
      expect(created).toMatchObject({ title: "Entrada", description: "Válida", quantity: 2 });

      as("admin");
      await expect(saveRafflePrize(prizeFields(eventId, { prizeId: created.id, raffleTitle: "Entrada VIP", raffleQuantity: "5" }))).rejects.toThrow(`REDIRECT:/company/${companyId}`);
      await expect(db.select({ title: rafflePrize.title, quantity: rafflePrize.quantity }).from(rafflePrize).where(eq(rafflePrize.id, created.id))).resolves.toEqual([{ title: "Entrada VIP", quantity: 5 }]);

      as("admin");
      await expect(deleteRafflePrize(form({ companyId, eventId, prizeId: created.id }))).rejects.toThrow(`REDIRECT:/company/${companyId}`);
      await expect(db.select().from(rafflePrize).where(eq(rafflePrize.eventId, eventId))).resolves.toHaveLength(0);
    });

    it("rejects a repeated title, a bad quantity and a raffle without required badges", async () => {
      const eventId = await endedEvent();
      const optionalOnly = await endedEvent();
      await db.update(badge).set({ required: false }).where(eq(badge.eventId, optionalOnly));

      as("admin");
      await expect(saveRafflePrize(prizeFields(eventId))).rejects.toThrow("REDIRECT");
      as("admin");
      await expect(saveRafflePrize(prizeFields(eventId))).resolves.toEqual({ error: "Ya existe un premio con ese título en esta rifa." });
      for (const raffleQuantity of ["0", "-1", "1.5", "abc"]) {
        as("admin");
        await expect(saveRafflePrize(prizeFields(eventId, { raffleTitle: "Otro", raffleQuantity }))).resolves.toEqual({ error: "La cantidad debe ser un entero entre 1 y 10000." });
      }
      as("admin");
      await expect(saveRafflePrize(prizeFields(optionalOnly))).resolves.toEqual({ error: "Agregá al menos un badge requerido antes de guardar un premio de la rifa." });
    });

    it("rejects creating, editing and deleting after the draw", async () => {
      const eventId = await endedEvent();
      const prizeId = await addPrize(eventId, "Entrada", 1);
      await complete(eventId, ["one"]);
      as("admin");
      await expect(draw(eventId)).rejects.toThrow("REDIRECT");

      const locked = { error: "La rifa ya se sorteó: no se puede modificar." };
      as("admin");
      await expect(saveRafflePrize(prizeFields(eventId, { raffleTitle: "Nuevo" }))).resolves.toEqual(locked);
      as("admin");
      await expect(saveRafflePrize(prizeFields(eventId, { prizeId, raffleQuantity: "9" }))).resolves.toEqual(locked);
      as("admin");
      await expect(deleteRafflePrize(form({ companyId, eventId, prizeId }))).rejects.toThrow(locked.error);
      await expect(db.select({ quantity: rafflePrize.quantity }).from(rafflePrize).where(eq(rafflePrize.id, prizeId))).resolves.toEqual([{ quantity: 1 }]);
    });

    it("rejects the admin of another company without touching the raffle", async () => {
      const eventId = await endedEvent();
      const prizeId = await addPrize(eventId, "Entrada", 1);
      await complete(eventId, ["one"]);

      as("otherAdmin");
      await expect(draw(eventId)).rejects.toThrow("REDIRECT:/home");
      as("otherAdmin");
      await expect(saveRafflePrize(prizeFields(eventId))).rejects.toThrow("REDIRECT:/home");
      as("otherAdmin");
      await expect(deleteRafflePrize(form({ companyId, eventId, prizeId }))).rejects.toThrow("REDIRECT:/home");
      // With access to their own company, a foreign event id does not exist for them.
      as("otherAdmin");
      await expect(drawRaffle(form({ companyId: otherCompanyId, eventId }))).resolves.toEqual({ error: "El evento no existe." });
      as("otherAdmin");
      await expect(saveRafflePrize(form({ companyId: otherCompanyId, eventId, raffleTitle: "Robado", raffleQuantity: "1" }))).resolves.toEqual({ error: "El evento no existe." });
      await expect(drawnAt(eventId)).resolves.toBeNull();
      await expect(db.select().from(rafflePrize).where(eq(rafflePrize.eventId, eventId))).resolves.toHaveLength(1);
    });
  });

  describe("rewards", () => {
    it("hides the raffle prizes from someone without a completion", async () => {
      const eventId = await endedEvent();
      await addPrize(eventId, "Entrada secreta", 1);
      await complete(eventId, ["one"]);

      const locked = await getEventRewards(ids.outsider, [eventId]);

      expect(locked.get(eventId)?.raffle).toEqual({ status: "locked" });
      expect(JSON.stringify(locked)).not.toContain("secreta");
      expect(JSON.stringify(locked)).not.toContain("Detalle");
    });

    it("reports no raffle for an event without prizes", async () => {
      const eventId = await endedEvent();
      await complete(eventId, ["one"]);

      expect((await getEventRewards(ids.one, [eventId])).get(eventId)?.raffle).toBeNull();
    });

    it("walks participating, won and not_drawn", async () => {
      const eventId = await endedEvent();
      await addPrize(eventId, "Entrada", 1);
      await addPrize(eventId, "Taza", 2);
      await complete(eventId, ["one", "two"]);

      const before = (await getEventRewards(ids.one, [eventId])).get(eventId)?.raffle;
      expect(before).toEqual({
        status: "participating",
        prizes: [
          { title: "Entrada", description: "Detalle Entrada", quantity: 1 },
          { title: "Taza", description: "Detalle Taza", quantity: 2 },
        ],
      });

      as("admin");
      await expect(draw(eventId)).rejects.toThrow("REDIRECT");
      // Two completers, three units: both win. Add a third completer afterwards to get a loser.
      await complete(eventId, ["three"]);
      const results = await Promise.all(completers.map(async (key) => [key, (await getEventRewards(ids[key], [eventId])).get(eventId)?.raffle] as const));

      const states = Object.fromEntries(results);
      expect(states.one).toMatchObject({ status: "won", winId: expect.any(String), claimedAt: null });
      expect(states.two).toMatchObject({ status: "won" });
      expect(states.three).toEqual({ status: "not_drawn" });
    });
  });

  describe("claiming", () => {
    it("lets only the winner claim, once", async () => {
      const eventId = await endedEvent();
      await addPrize(eventId, "Entrada", 1);
      await complete(eventId, ["one"]);
      as("admin");
      await expect(draw(eventId)).rejects.toThrow("REDIRECT");
      const [win] = await wins(eventId);

      as("two");
      await expect(claimRaffleWin(win.id)).rejects.toThrow("No ganaste este premio.");
      await expect(wins(eventId)).resolves.toEqual([expect.objectContaining({ claimedAt: null })]);

      as("one");
      await claimRaffleWin(win.id);
      const [first] = await wins(eventId);
      as("one");
      await claimRaffleWin(win.id);
      const [second] = await wins(eventId);

      expect(first.claimedAt).toBeInstanceOf(Date);
      expect(second.claimedAt).toEqual(first.claimedAt);
      expect((await getEventRewards(ids.one, [eventId])).get(eventId)?.raffle).toMatchObject({ status: "won", claimedAt: first.claimedAt });
    });
  });
});
