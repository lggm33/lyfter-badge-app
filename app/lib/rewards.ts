import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { event, eventCompletion, rafflePrize, raffleWin } from "@/db/schema";

export type PrizeState =
  | { status: "locked" }
  | { status: "revealed"; title: string; description: string | null }
  | { status: "claimed"; title: string; description: string | null; claimedAt: Date };

export type RaffleState =
  | { status: "locked" }
  | { status: "participating"; prizes: { title: string; description: string | null; quantity: number }[] }
  | { status: "won"; winId: string; title: string; description: string | null; claimedAt: Date | null }
  | { status: "not_drawn" };

export type EventRewards = { prize: PrizeState | null; raffle: RaffleState | null };

/**
 * The only read of prize content for participants. Content is joined to the
 * user's event_completion row in SQL, so without it the prize text never leaves
 * the database: the caller only learns that a prize or a raffle exists.
 */
export async function getEventRewards(userId: string, eventIds: string[]): Promise<Map<string, EventRewards>> {
  if (eventIds.length === 0) return new Map();

  const [rows, prizes, wins] = await Promise.all([
    db
      .select({
        eventId: event.id,
        completed: sql<boolean>`${eventCompletion.id} is not null`,
        hasPrize: sql<boolean>`${event.prizeTitle} is not null`,
        title: sql<string | null>`case when ${eventCompletion.id} is not null then ${event.prizeTitle} end`,
        description: sql<string | null>`case when ${eventCompletion.id} is not null then ${event.prizeDescription} end`,
        claimedAt: eventCompletion.claimedAt,
        hasRaffle: sql<boolean>`exists (select 1 from ${rafflePrize} where ${rafflePrize.eventId} = ${event.id})`,
        raffleDrawnAt: event.raffleDrawnAt,
      })
      .from(event)
      .leftJoin(eventCompletion, and(eq(eventCompletion.eventId, event.id), eq(eventCompletion.userId, userId)))
      .where(inArray(event.id, eventIds)),
    db
      .select({ eventId: rafflePrize.eventId, title: rafflePrize.title, description: rafflePrize.description, quantity: rafflePrize.quantity })
      .from(rafflePrize)
      .innerJoin(eventCompletion, and(eq(eventCompletion.eventId, rafflePrize.eventId), eq(eventCompletion.userId, userId)))
      .where(inArray(rafflePrize.eventId, eventIds))
      .orderBy(rafflePrize.title),
    db
      .select({ eventId: raffleWin.eventId, winId: raffleWin.id, title: rafflePrize.title, description: rafflePrize.description, claimedAt: raffleWin.claimedAt })
      .from(raffleWin)
      .innerJoin(rafflePrize, eq(raffleWin.rafflePrizeId, rafflePrize.id))
      .where(and(eq(raffleWin.userId, userId), inArray(raffleWin.eventId, eventIds))),
  ]);

  const prizesByEvent = Map.groupBy(prizes, (row) => row.eventId);
  const winsByEvent = new Map(wins.map((row) => [row.eventId, row]));

  return new Map(
    rows.map((row) => {
      const win = winsByEvent.get(row.eventId);
      const inPlay = (prizesByEvent.get(row.eventId) ?? []).map(({ title, description, quantity }) => ({ title, description, quantity }));
      const raffle = raffleState(row, win, inPlay);
      return [row.eventId, { prize: prizeState(row), raffle }];
    }),
  );
}

function prizeState(row: { hasPrize: boolean; title: string | null; description: string | null; claimedAt: Date | null }): PrizeState | null {
  if (!row.hasPrize) return null;
  if (row.title === null) return { status: "locked" };
  if (row.claimedAt) return { status: "claimed", title: row.title, description: row.description, claimedAt: row.claimedAt };
  return { status: "revealed", title: row.title, description: row.description };
}

function raffleState(
  row: { completed: boolean; hasRaffle: boolean; raffleDrawnAt: Date | null },
  win: { winId: string; title: string; description: string | null; claimedAt: Date | null } | undefined,
  prizes: { title: string; description: string | null; quantity: number }[],
): RaffleState | null {
  if (!row.hasRaffle) return null;
  if (!row.completed) return { status: "locked" };
  if (win) return { status: "won", ...win };
  if (row.raffleDrawnAt) return { status: "not_drawn" };
  return { status: "participating", prizes };
}
