import { and, eq, sql, type SQL } from "drizzle-orm";
import { COSTA_RICA_TIME_ZONE } from "@/app/lib/costa-rica-time";
import { eventPhaseSql } from "@/app/lib/event-phase";
import { db } from "@/db";
import { event } from "@/db/schema";

/** Wall-clock hour for “horario de afluencia”. Costa Rica does not observe DST. */
export const METRICS_TIME_ZONE = COSTA_RICA_TIME_ZONE;

export const TOP_METRICS_LIMIT = 10;

const BADGE_TYPE_FILTERS = ["TALK", "STAND"] as const;

export type BadgeTypeFilter = "ALL" | (typeof BADGE_TYPE_FILTERS)[number];

export type MetricsScope = { kind: "platform" } | { kind: "company"; companyId: string };

export type MetricsQuery = {
  eventId: string | null;
  badgeType: BadgeTypeFilter;
};

export type MetricCards = {
  companies: number | null;
  users: number | null;
  events: { draft: number; active: number; finished: number };
  checkIns: number;
  redemptions: number;
  completions: number;
};

export type TopBadge = {
  badgeId: string;
  name: string;
  type: string;
  eventId: string;
  eventName: string;
  companyId: string;
  companyName: string;
  redemptions: number;
};

export type TopEvent = {
  eventId: string;
  name: string;
  status: string;
  companyId: string;
  companyName: string;
  checkIns: number;
};

export type TrafficHour = {
  hour: number;
  arrivals: number;
  redemptions: number;
};

export type MetricsEventOption = {
  id: string;
  name: string;
  companyName: string;
  checkIns: number;
};

export type MetricsSnapshot = {
  scopeKind: MetricsScope["kind"];
  eventId: string | null;
  badgeType: BadgeTypeFilter;
  cards: MetricCards;
  topBadges: TopBadge[];
  topEvents: TopEvent[] | null;
  traffic: TrafficHour[];
  events: MetricsEventOption[];
};

type SearchValue = string | string[] | undefined;

type MetricsSearchParams = {
  event?: SearchValue;
  type?: SearchValue;
};

type ResolvedScope = {
  companyId: string | null;
  eventId: string | null;
};

/**
 * Platform metrics, or one company's. `companyId` comes from the route on the
 * company panel, never from the query string. An event id outside that scope
 * is dropped before the queries run.
 */
export async function getMetrics(scope: MetricsScope, query: MetricsQuery): Promise<MetricsSnapshot> {
  const companyId = scope.kind === "company" ? scope.companyId : null;
  const eventId = await resolveEventId(companyId, query.eventId);
  const resolved = { companyId, eventId };
  const [cards, topBadges, traffic, events, topEvents] = await Promise.all([
    loadCards(scope.kind, resolved),
    loadTopBadges(resolved, query.badgeType),
    loadTraffic(resolved),
    loadEvents(companyId),
    scope.kind === "platform" ? loadTopEvents() : Promise.resolve(null),
  ]);

  return {
    scopeKind: scope.kind,
    eventId,
    badgeType: query.badgeType,
    cards,
    topBadges,
    topEvents,
    traffic,
    events,
  };
}

export function parseMetricsQuery(params: MetricsSearchParams): MetricsQuery {
  const eventId = firstParam(params.event).trim();
  const type = firstParam(params.type).trim();
  return {
    eventId: eventId.length > 0 ? eventId : null,
    badgeType: isBadgeTypeFilter(type) ? type : "ALL",
  };
}

async function resolveEventId(companyId: string | null, requestedEventId: string | null) {
  if (!requestedEventId) return null;

  const conditions = [eq(event.id, requestedEventId)];
  if (companyId) conditions.push(eq(event.companyId, companyId));
  const [row] = await db
    .select({ id: event.id })
    .from(event)
    .where(and(...conditions));
  return row?.id ?? null;
}

async function loadCards(scopeKind: MetricsScope["kind"], resolved: ResolvedScope): Promise<MetricCards> {
  const [activity, platformTotals] = await Promise.all([
    loadActivity(resolved),
    scopeKind === "platform" ? loadPlatformTotals() : Promise.resolve(null),
  ]);

  return {
    companies: platformTotals?.companies ?? null,
    users: platformTotals?.users ?? null,
    events: activity.events,
    checkIns: activity.checkIns,
    redemptions: activity.redemptions,
    completions: activity.completions,
  };
}

async function loadActivity(resolved: ResolvedScope) {
  const result = await db.execute<{
    draftEvents: number;
    activeEvents: number;
    finishedEvents: number;
    checkIns: number;
    redemptions: number;
    completions: number;
  }>(sql`
    SELECT
      (SELECT count(*)::int FROM event e WHERE ${eventPhaseSql("e")} = 'DRAFT' AND ${eventScope(resolved)}) AS "draftEvents",
      (SELECT count(*)::int FROM event e WHERE ${eventPhaseSql("e")} = 'ACTIVE' AND ${eventScope(resolved)}) AS "activeEvents",
      (SELECT count(*)::int FROM event e WHERE ${eventPhaseSql("e")} = 'FINISHED' AND ${eventScope(resolved)}) AS "finishedEvents",
      (SELECT count(*)::int FROM event_membership m JOIN event e ON e.id = m.event_id WHERE ${eventScope(resolved)}) AS "checkIns",
      (SELECT count(*)::int FROM badge_redemption r JOIN event e ON e.id = r.event_id WHERE ${eventScope(resolved)}) AS "redemptions",
      (SELECT count(*)::int FROM event_completion c JOIN event e ON e.id = c.event_id WHERE ${eventScope(resolved)}) AS "completions"
  `);
  const row = result.rows[0];

  return {
    events: {
      draft: asNumber(row?.draftEvents),
      active: asNumber(row?.activeEvents),
      finished: asNumber(row?.finishedEvents),
    },
    checkIns: asNumber(row?.checkIns),
    redemptions: asNumber(row?.redemptions),
    completions: asNumber(row?.completions),
  };
}

async function loadPlatformTotals() {
  const result = await db.execute<{ companies: number; users: number }>(sql`
    SELECT
      (SELECT count(*)::int FROM company) AS companies,
      (SELECT count(*)::int FROM "user") AS users
  `);
  const row = result.rows[0];
  return {
    companies: asNumber(row?.companies),
    users: asNumber(row?.users),
  };
}

async function loadTopBadges(resolved: ResolvedScope, badgeType: BadgeTypeFilter): Promise<TopBadge[]> {
  const typeFilter = badgeType === "ALL" ? sql`true` : sql`b.type = ${badgeType}`;
  const result = await db.execute<TopBadge>(sql`
    SELECT b.id AS "badgeId",
           b.name,
           b.type,
           e.id AS "eventId",
           e.name AS "eventName",
           co.id AS "companyId",
           co.name AS "companyName",
           count(r.id)::int AS redemptions
    FROM badge_redemption r
    JOIN badge b ON b.id = r.badge_id
    JOIN event e ON e.id = r.event_id
    JOIN company co ON co.id = e.company_id
    WHERE ${eventScope(resolved)} AND ${typeFilter}
    GROUP BY b.id, b.name, b.type, e.id, e.name, co.id, co.name
    ORDER BY count(r.id) DESC, b.name ASC, b.id ASC
    LIMIT ${TOP_METRICS_LIMIT}
  `);

  return result.rows.map((row) => ({
    ...row,
    redemptions: asNumber(row.redemptions),
  }));
}

async function loadTopEvents(): Promise<TopEvent[]> {
  const result = await db.execute<TopEvent>(sql`
    SELECT e.id AS "eventId",
           e.name,
           ${eventPhaseSql("e")} AS status,
           co.id AS "companyId",
           co.name AS "companyName",
           count(m.id)::int AS "checkIns"
    FROM event_membership m
    JOIN event e ON e.id = m.event_id
    JOIN company co ON co.id = e.company_id
    GROUP BY e.id, e.name, e.status, e.ends_at, co.id, co.name
    ORDER BY count(m.id) DESC, e.name ASC, e.id ASC
    LIMIT ${TOP_METRICS_LIMIT}
  `);

  return result.rows.map((row) => ({
    ...row,
    checkIns: asNumber(row.checkIns),
  }));
}

async function loadTraffic(resolved: ResolvedScope): Promise<TrafficHour[]> {
  const result = await db.execute<TrafficHour>(sql`
    WITH hours AS (
      SELECT generate_series(0, 23) AS hour
    ),
    arrivals AS (
      SELECT ${hourInCostaRica(sql`m.checked_in_at`)} AS hour,
             count(*)::int AS total
      FROM event_membership m
      JOIN event e ON e.id = m.event_id
      WHERE ${eventScope(resolved)}
      GROUP BY 1
    ),
    redemptions AS (
      SELECT ${hourInCostaRica(sql`r.created_at`)} AS hour,
             count(*)::int AS total
      FROM badge_redemption r
      JOIN event e ON e.id = r.event_id
      WHERE ${eventScope(resolved)}
      GROUP BY 1
    )
    SELECT hours.hour::int AS hour,
           coalesce(arrivals.total, 0)::int AS arrivals,
           coalesce(redemptions.total, 0)::int AS redemptions
    FROM hours
    LEFT JOIN arrivals ON arrivals.hour = hours.hour
    LEFT JOIN redemptions ON redemptions.hour = hours.hour
    ORDER BY hours.hour
  `);

  return result.rows.map((row) => ({
    hour: asNumber(row.hour),
    arrivals: asNumber(row.arrivals),
    redemptions: asNumber(row.redemptions),
  }));
}

async function loadEvents(companyId: string | null): Promise<MetricsEventOption[]> {
  const where = companyId ? sql`e.company_id = ${companyId}` : sql`true`;
  const result = await db.execute<MetricsEventOption>(sql`
    SELECT e.id,
           e.name,
           co.name AS "companyName",
           count(m.id)::int AS "checkIns"
    FROM event e
    JOIN company co ON co.id = e.company_id
    LEFT JOIN event_membership m ON m.event_id = e.id
    WHERE ${where}
    GROUP BY e.id, e.name, co.name, e.starts_at
    ORDER BY e.starts_at DESC, e.name ASC
  `);

  return result.rows.map((row) => ({
    ...row,
    checkIns: asNumber(row.checkIns),
  }));
}

/**
 * Stored timestamps are `timestamp without time zone` written as UTC.
 * Interpret that wall clock as UTC, then take the hour in Costa Rica.
 */
function hourInCostaRica(column: SQL) {
  return sql`extract(hour from (${column} at time zone 'UTC') at time zone ${METRICS_TIME_ZONE})::int`;
}

function eventScope(resolved: ResolvedScope) {
  if (resolved.eventId) return sql`e.id = ${resolved.eventId}`;
  if (resolved.companyId) return sql`e.company_id = ${resolved.companyId}`;
  return sql`true`;
}

function isBadgeTypeFilter(value: string): value is Exclude<BadgeTypeFilter, "ALL"> {
  return BADGE_TYPE_FILTERS.some((type) => type === value);
}

function asNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function firstParam(value: SearchValue) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
