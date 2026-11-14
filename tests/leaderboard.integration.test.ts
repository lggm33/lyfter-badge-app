import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { badge, badgeRedemption, company, event, xpLedger } from "@/db/schema";
import {
  getLeaderboardPage,
  getLeaderboardPosition,
  LEADERBOARD_PAGE_SIZE,
  listLeaderboardEvents,
} from "@/app/lib/leaderboard";
import { requireTestEnv, uniqueEmail } from "./helpers";

const companyId = randomUUID();
const eventA = randomUUID();
const eventB = randomUUID();
const crowdEvent = randomUUID();
const draftEvent = randomUUID();
const badges = {
  talk1: randomUUID(),
  talk2: randomUUID(),
  stand: randomUUID(),
  content: randomUUID(),
  other: randomUUID(),
  crowd: randomUUID(),
};
const people = {
  alice: randomUUID(),
  bob: randomUUID(),
  carol: randomUUID(),
  dave: randomUUID(),
  erin: randomUUID(),
  nobody: randomUUID(),
};
const crowd = Array.from({ length: LEADERBOARD_PAGE_SIZE + 5 }, () => randomUUID());
const userIds = [...Object.values(people), ...crowd];
const base = new Date("2026-03-01T10:00:00.000Z").getTime();

function at(minutes: number) {
  return new Date(base + minutes * 60_000);
}

async function redeem(userId: string, badgeId: string, eventId: string, amount: number, createdAt: Date) {
  const redemptionId = randomUUID();
  await db.insert(badgeRedemption).values({ id: redemptionId, badgeId, eventId, userId, createdAt });
  await db.insert(xpLedger).values({ id: randomUUID(), redemptionId, userId, amount });
}

function ids(rows: { userId: string }[]) {
  return rows.map((row) => row.userId);
}

describe("leaderboard", () => {
  beforeAll(async () => {
    requireTestEnv();
    await db.insert(user).values(
      userIds.map((id, index) => ({ id, name: `Ranker ${index}`, email: uniqueEmail(`leaderboard-${index}`) })),
    );
    await db.insert(company).values({ id: companyId, name: "Ranking Co", slug: `ranking-${companyId}` });
    const window = { startsAt: at(0), endsAt: at(600) };
    await db.insert(event).values([
      { id: eventA, companyId, name: "Ranking A", slug: `a-${eventA}`, status: "ACTIVE", ...window },
      { id: eventB, companyId, name: "Ranking B", slug: `b-${eventB}`, status: "FINISHED", ...window },
      { id: crowdEvent, companyId, name: "Ranking crowd", slug: `c-${crowdEvent}`, status: "ACTIVE", ...window },
      { id: draftEvent, companyId, name: "Ranking draft", slug: `d-${draftEvent}`, ...window },
    ]);
    const common = { rarity: "COMMON", xp: 999, required: true };
    await db.insert(badge).values([
      { id: badges.talk1, eventId: eventA, name: "Talk 1", type: "TALK", ...common },
      { id: badges.talk2, eventId: eventA, name: "Talk 2", type: "TALK", ...common },
      { id: badges.stand, eventId: eventA, name: "Stand", type: "STAND", ...common },
      { id: badges.content, eventId: eventA, name: "Content", type: "CONTENT", ...common },
      { id: badges.other, eventId: eventB, name: "Other", type: "TALK", ...common },
      { id: badges.crowd, eventId: crowdEvent, name: "Crowd", type: "STAND", ...common },
    ]);

    // Event A: bob 50 XP; dave, alice and carol 20 XP each, reached at minutes 0, 2 and 5.
    await redeem(people.dave, badges.content, eventA, 20, at(0));
    await redeem(people.alice, badges.talk1, eventA, 10, at(1));
    await redeem(people.alice, badges.talk2, eventA, 10, at(2));
    await redeem(people.bob, badges.stand, eventA, 50, at(3));
    await redeem(people.carol, badges.talk1, eventA, 10, at(4));
    await redeem(people.carol, badges.stand, eventA, 10, at(5));
    // Event B only: erin outscores everyone in A but must not show up there.
    await redeem(people.erin, badges.other, eventB, 1000, at(6));
    await redeem(people.alice, badges.other, eventB, 5, at(7));
    // Crowd: same XP, one minute apart, so arrival decides the order.
    for (const [index, userId] of crowd.entries()) {
      await redeem(userId, badges.crowd, crowdEvent, 10, at(100 + index));
    }
  });

  afterAll(async () => {
    await db.delete(company).where(eq(company.id, companyId));
    await db.delete(user).where(inArray(user.id, userIds));
  });

  it("ordena por XP y desempata por quien llegó primero", async () => {
    const board = await getLeaderboardPage({ eventId: eventA, sort: "xp", page: 1 });

    expect(ids(board.rows)).toEqual([people.bob, people.dave, people.alice, people.carol]);
    expect(board.rows.map((row) => row.position)).toEqual([1, 2, 3, 4]);
    expect(board.rows[0]).toMatchObject({ name: expect.any(String), xp: 50, talks: 0, stands: 1 });
    expect(board.hasNextPage).toBe(false);
  });

  it("ordena por charlas y por stands, dejando afuera a quien tiene cero", async () => {
    const talks = await getLeaderboardPage({ eventId: eventA, sort: "talks", page: 1 });
    const stands = await getLeaderboardPage({ eventId: eventA, sort: "stands", page: 1 });

    expect(ids(talks.rows)).toEqual([people.alice, people.carol]);
    expect(talks.rows.map((row) => row.talks)).toEqual([2, 1]);
    expect(ids(stands.rows)).toEqual([people.bob, people.carol]);
  });

  it("el ranking por evento no mezcla otros eventos y el global los suma", async () => {
    const board = await getLeaderboardPage({ eventId: eventA, sort: "xp", page: 1 });
    expect(ids(board.rows)).not.toContain(people.erin);
    await expect(getLeaderboardPosition({ eventId: eventA, sort: "xp", userId: people.erin })).resolves.toBeNull();

    const erin = await getLeaderboardPosition({ eventId: null, sort: "xp", userId: people.erin });
    const bob = await getLeaderboardPosition({ eventId: null, sort: "xp", userId: people.bob });
    const alice = await getLeaderboardPosition({ eventId: null, sort: "xp", userId: people.alice });
    expect(erin!.position).toBeLessThan(bob!.position);
    expect(alice).toMatchObject({ xp: 25, talks: 3 });
  });

  it("pagina de a 50 y ubica tu posición en la página 2", async () => {
    const first = await getLeaderboardPage({ eventId: crowdEvent, sort: "xp", page: 1 });
    const second = await getLeaderboardPage({ eventId: crowdEvent, sort: "xp", page: 2 });

    expect(ids(first.rows)).toEqual(crowd.slice(0, LEADERBOARD_PAGE_SIZE));
    expect(first.hasNextPage).toBe(true);
    expect(ids(second.rows)).toEqual(crowd.slice(LEADERBOARD_PAGE_SIZE));
    expect(second.rows[0].position).toBe(LEADERBOARD_PAGE_SIZE + 1);
    expect(second.hasNextPage).toBe(false);

    const me = await getLeaderboardPosition({ eventId: crowdEvent, sort: "xp", userId: crowd[52] });
    expect(me).toMatchObject({ userId: crowd[52], position: 53 });
    expect(second.rows).toContainEqual(me);
  });

  it("quien no tiene canjes no aparece", async () => {
    await expect(getLeaderboardPosition({ eventId: null, sort: "xp", userId: people.nobody })).resolves.toBeNull();
    const board = await getLeaderboardPage({ eventId: eventA, sort: "xp", page: 1 });
    expect(ids(board.rows)).not.toContain(people.nobody);
  });

  it("el selector lista eventos activos y finalizados, no borradores", async () => {
    const events = (await listLeaderboardEvents()).map((item) => item.id);

    expect(events).toEqual(expect.arrayContaining([eventA, eventB, crowdEvent]));
    expect(events).not.toContain(draftEvent);
  });
});
