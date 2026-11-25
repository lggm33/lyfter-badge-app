import { sql } from "drizzle-orm";

export type EventPhase = "DRAFT" | "ACTIVE" | "FINISHED";

/** Draft stays draft. Anything past `endsAt` is finished, even if nobody opened the company panel. */
export function eventPhase(row: { status: string; endsAt: Date }, now = Date.now()): EventPhase {
  if (row.status === "DRAFT") return "DRAFT";
  if (row.status === "FINISHED" || row.endsAt.getTime() <= now) return "FINISHED";
  return "ACTIVE";
}

/** Same rule as `eventPhase`, for SQL that stores UTC wall time in `timestamp without time zone`. */
export function eventPhaseSql(alias: "e") {
  const status = sql.raw(`${alias}.status`);
  const endsAt = sql.raw(`${alias}.ends_at`);
  return sql`CASE
    WHEN ${status} = 'DRAFT' THEN 'DRAFT'
    WHEN ${status} = 'FINISHED' OR ${endsAt} <= (now() AT TIME ZONE 'UTC') THEN 'FINISHED'
    ELSE 'ACTIVE'
  END`;
}
