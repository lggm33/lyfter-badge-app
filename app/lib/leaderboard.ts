import { asc, eq, inArray, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { company, event } from "@/db/schema";

export const LEADERBOARD_PAGE_SIZE = 50;

/** Whitelisted metrics: the column names never come from the URL. */
const METRICS = {
  xp: { score: sql.raw("xp"), at: sql.raw("xp_at") },
  talks: { score: sql.raw("talks"), at: sql.raw("talks_at") },
  stands: { score: sql.raw("stands"), at: sql.raw("stands_at") },
} as const;

export type LeaderboardSort = keyof typeof METRICS;

export type LeaderboardRow = {
  userId: string;
  name: string;
  xp: number;
  talks: number;
  stands: number;
  position: number;
};

type Scope = { eventId: string | null; sort: LeaderboardSort };

export function parseLeaderboardSort(raw: string): LeaderboardSort {
  return Object.hasOwn(METRICS, raw) ? (raw as LeaderboardSort) : "xp";
}

/**
 * One page of the ranking, global or for one event. Only users with the metric
 * above zero are ranked; ties go to whoever reached that score first.
 */
export async function getLeaderboardPage({ eventId, sort, page }: Scope & { page: number }) {
  const offset = (page - 1) * LEADERBOARD_PAGE_SIZE;
  const rows = await runRanked(
    { eventId, sort },
    sql`ORDER BY position LIMIT ${LEADERBOARD_PAGE_SIZE + 1} OFFSET ${offset}`,
  );

  return {
    rows: rows.slice(0, LEADERBOARD_PAGE_SIZE),
    hasNextPage: rows.length > LEADERBOARD_PAGE_SIZE,
  };
}

/** The user's row in the same ranking, or null without a qualifying redemption. */
export async function getLeaderboardPosition({ eventId, sort, userId }: Scope & { userId: string }) {
  const [row] = await runRanked({ eventId, sort }, sql`WHERE user_id = ${userId}`);
  return row ?? null;
}

/** Events a participant can pick in the ranking selector. */
export async function listLeaderboardEvents() {
  return db
    .select({ id: event.id, name: event.name, companyName: company.name })
    .from(event)
    .innerJoin(company, eq(event.companyId, company.id))
    .where(inArray(event.status, ["ACTIVE", "FINISHED"]))
    .orderBy(asc(event.startsAt), asc(event.name));
}

async function runRanked({ eventId, sort }: Scope, tail: SQL) {
  const metric = METRICS[sort];
  const result = await db.execute<LeaderboardRow>(sql`
    WITH scores AS (
      SELECT r.user_id,
             SUM(l.amount)::int                                AS xp,
             COUNT(*) FILTER (WHERE b.type = 'TALK')::int      AS talks,
             COUNT(*) FILTER (WHERE b.type = 'STAND')::int     AS stands,
             MAX(r.created_at)                                 AS xp_at,
             MAX(r.created_at) FILTER (WHERE b.type = 'TALK')  AS talks_at,
             MAX(r.created_at) FILTER (WHERE b.type = 'STAND') AS stands_at
      FROM badge_redemption r
      JOIN badge b     ON b.id = r.badge_id
      JOIN xp_ledger l ON l.redemption_id = r.id
      ${eventId ? sql`WHERE r.event_id = ${eventId}` : sql``}
      GROUP BY r.user_id
    ), ranked AS (
      SELECT s.user_id, u.name, s.xp, s.talks, s.stands,
             ROW_NUMBER() OVER (ORDER BY s.${metric.score} DESC, s.${metric.at} ASC, s.user_id)::int AS position
      FROM scores s JOIN "user" u ON u.id = s.user_id
      WHERE s.${metric.score} > 0
    )
    SELECT user_id AS "userId", name, xp, talks, stands, position FROM ranked ${tail}
  `);
  return result.rows;
}
