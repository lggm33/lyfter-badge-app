import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, or, sql, type SQL } from "drizzle-orm";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { auditLog, company, event } from "@/db/schema";
import { buildUserSearchPattern } from "@/app/lib/user-search";

export const AUDIT_PAGE_SIZE = 50;

export const AUDIT_ACTIONS = [
  "company.created",
  "company_admin.assigned",
  "company_admin.removed",
  "event.created",
  "event.updated",
  "event.activated",
  "event.deleted",
  "badge.created",
  "badge.updated",
  "badge.deleted",
  "prize.saved",
  "raffle_prize.saved",
  "raffle_prize.deleted",
  "raffle.drawn",
  "display.created",
  "display.revoked",
  "impersonation.started",
  "impersonation.stopped",
  "photo.created",
  "photo.deleted",
  "user.disabled",
  "user.enabled",
] as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const AUDIT_RESOURCE_TYPES = ["company", "member", "event", "badge", "prize", "raffle", "display", "impersonation", "photo", "user"] as const;

export type AuditResourceType = (typeof AUDIT_RESOURCE_TYPES)[number];

export type AuditMetadata = Record<string, string | number | boolean | null>;

const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  "company.created": "Empresa creada",
  "company_admin.assigned": "Admin asignado",
  "company_admin.removed": "Admin quitado",
  "event.created": "Evento creado",
  "event.updated": "Evento editado",
  "event.activated": "Evento activado",
  "event.deleted": "Evento eliminado",
  "badge.created": "Badge creado",
  "badge.updated": "Badge editado",
  "badge.deleted": "Badge eliminado",
  "prize.saved": "Premio guardado",
  "raffle_prize.saved": "Premio de rifa guardado",
  "raffle_prize.deleted": "Premio de rifa eliminado",
  "raffle.drawn": "Rifa sorteada",
  "display.created": "Pantalla creada",
  "display.revoked": "Pantalla revocada",
  "impersonation.started": "Impersonación iniciada",
  "impersonation.stopped": "Impersonación terminada",
  "photo.created": "Foto agregada",
  "photo.deleted": "Foto eliminada",
  "user.disabled": "Cuenta desactivada",
  "user.enabled": "Cuenta reactivada",
};

type AuditExecutor = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type AuditEntry = {
  actorId: string;
  actorName: string;
  action: AuditAction;
  companyId?: string | null;
  eventId?: string | null;
  resourceType: AuditResourceType;
  resourceId?: string | null;
  metadata?: AuditMetadata | null;
};

export type AuditQuery = {
  scopeCompanyId: string | null;
  companyId: string | null;
  eventId: string | null;
  actorQuery: string;
  action: AuditAction | null;
  page: number;
};

export type AuditListRow = {
  id: string;
  createdAt: Date;
  actorName: string;
  actorEmail: string | null;
  action: string;
  companyName: string | null;
  eventName: string | null;
  metadata: AuditMetadata | null;
};

export type AuditListResult = {
  rows: AuditListRow[];
  hasNextPage: boolean;
  companyId: string | null;
  eventId: string | null;
  action: AuditAction | null;
  actorQuery: string;
  actorTooShort: boolean;
  page: number;
};

type AuditSearchParams = {
  company?: string | string[];
  event?: string | string[];
  actor?: string | string[];
  action?: string | string[];
  page?: string | string[];
};

/** The name stored on the row. A blank profile name falls back to the email so the log stays readable. */
export function auditActorName(account: { name: string; email?: string | null }) {
  const name = account.name.trim();
  if (name.length > 0) return name;
  const email = account.email?.trim();
  if (email) return email;
  return "Usuario";
}

export function auditActionLabel(action: string) {
  if (isAuditAction(action)) return AUDIT_ACTION_LABELS[action];
  return action;
}

export function parseAuditAction(value: string | null | undefined): AuditAction | null {
  if (value && isAuditAction(value)) return value;
  return null;
}

export function parseAuditSearchParams(params: AuditSearchParams): Omit<AuditQuery, "scopeCompanyId"> {
  const actorQuery = firstParam(params.actor).trim();
  const page = Number.parseInt(firstParam(params.page), 10);
  return {
    companyId: firstParam(params.company) || null,
    eventId: firstParam(params.event) || null,
    actorQuery,
    action: parseAuditAction(firstParam(params.action)),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

/** A short line for the log card. Unknown keys stay out of the screen. */
export function describeAuditMetadata(metadata: AuditMetadata | null) {
  if (!metadata) return null;
  const parts: string[] = [];
  pushText(parts, metadata.slug);
  pushText(parts, metadata.userName);
  pushText(parts, metadata.name);
  pushText(parts, metadata.title);
  if (metadata.removed === true) parts.push("premio quitado");
  pushText(parts, metadata.fields);
  if (typeof metadata.winners === "number") parts.push(`${metadata.winners} ganadores`);
  if (typeof metadata.badgeId === "string" && metadata.badgeId.length > 0) parts.push("badge");
  if (metadata.badgeId === "") parts.push("check-in");
  if (metadata.impersonating === true) parts.push("impersonando");
  if (parts.length === 0) return null;
  return parts.join(" · ");
}

/**
 * Writes one audit row in the caller's transaction.
 * Names are copied here, while the company and the event still exist.
 */
export async function recordAudit(tx: AuditExecutor, entry: AuditEntry) {
  const scope = await resolveAuditScope(tx, entry.companyId ?? null, entry.eventId ?? null);
  await tx.insert(auditLog).values({
    id: randomUUID(),
    actorId: entry.actorId,
    actorName: entry.actorName,
    action: entry.action,
    companyId: scope.companyId,
    companyName: scope.companyName,
    eventId: scope.eventId,
    eventName: scope.eventName,
    resourceType: entry.resourceType,
    resourceId: entry.resourceId ?? null,
    metadata: entry.metadata ?? null,
  });
}

/** Platform log. A company or event id that does not exist is ignored. */
export async function listPlatformAudit(query: Omit<AuditQuery, "scopeCompanyId">) {
  return listAudit({ ...query, scopeCompanyId: null });
}

/** Company log. The company comes from the route, never from the query string. */
export async function listCompanyAudit(companyId: string, query: Omit<AuditQuery, "scopeCompanyId" | "companyId">) {
  return listAudit({ ...query, scopeCompanyId: companyId, companyId: null });
}

export async function listAuditCompanies() {
  return db.select({ id: company.id, name: company.name }).from(company).orderBy(asc(company.name));
}

export async function listAuditEvents(companyId: string | null) {
  const rows = db
    .select({ id: event.id, name: event.name, companyName: company.name })
    .from(event)
    .innerJoin(company, eq(event.companyId, company.id))
    .orderBy(asc(company.name), asc(event.name));
  if (!companyId) return rows;
  return rows.where(eq(event.companyId, companyId));
}

async function listAudit(query: AuditQuery): Promise<AuditListResult> {
  const actorTooShort = query.actorQuery.trim().length === 1;
  const pattern = buildUserSearchPattern(query.actorQuery);
  const companyId = await resolveCompanyFilter(query.scopeCompanyId, query.companyId);
  const eventId = await resolveEventFilter(query.eventId, query.scopeCompanyId ?? companyId);
  const filters = [
    companyId ? eq(auditLog.companyId, companyId) : null,
    eventId ? eq(auditLog.eventId, eventId) : null,
    query.action ? eq(auditLog.action, query.action) : null,
    pattern ? actorMatches(pattern) : null,
  ].filter((filter): filter is SQL => filter !== null);

  const rows = await db
    .select({
      id: auditLog.id,
      createdAt: auditLog.createdAt,
      actorName: auditLog.actorName,
      actorEmail: user.email,
      action: auditLog.action,
      companyName: auditLog.companyName,
      eventName: auditLog.eventName,
      metadata: auditLog.metadata,
    })
    .from(auditLog)
    .leftJoin(user, eq(auditLog.actorId, user.id))
    .where(filters.length > 0 ? and(...filters) : undefined)
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(AUDIT_PAGE_SIZE + 1)
    .offset((query.page - 1) * AUDIT_PAGE_SIZE);

  return {
    rows: rows.slice(0, AUDIT_PAGE_SIZE),
    hasNextPage: rows.length > AUDIT_PAGE_SIZE,
    companyId,
    eventId,
    action: query.action,
    actorQuery: query.actorQuery.trim(),
    actorTooShort,
    page: query.page,
  };
}

async function resolveAuditScope(tx: AuditExecutor, companyId: string | null, eventId: string | null) {
  const eventRow = eventId ? await findEvent(tx, eventId) : null;
  const eventMatchesCompany = Boolean(eventRow) && (!companyId || eventRow?.companyId === companyId);
  const resolvedCompanyId = companyId ?? (eventMatchesCompany ? eventRow?.companyId ?? null : null);
  const companyName = resolvedCompanyId ? await findCompanyName(tx, resolvedCompanyId) : null;
  return {
    companyId: resolvedCompanyId,
    companyName,
    eventId: eventMatchesCompany ? eventId : null,
    eventName: eventMatchesCompany ? eventRow?.name ?? null : null,
  };
}

async function findEvent(tx: AuditExecutor, eventId: string) {
  const [row] = await tx
    .select({ name: event.name, companyId: event.companyId })
    .from(event)
    .where(eq(event.id, eventId));
  return row ?? null;
}

async function findCompanyName(tx: AuditExecutor, companyId: string) {
  const [row] = await tx.select({ name: company.name }).from(company).where(eq(company.id, companyId));
  return row?.name ?? null;
}

async function resolveCompanyFilter(scopeCompanyId: string | null, requestedCompanyId: string | null) {
  if (scopeCompanyId) return scopeCompanyId;
  if (!requestedCompanyId) return null;
  const [row] = await db.select({ id: company.id }).from(company).where(eq(company.id, requestedCompanyId));
  return row?.id ?? null;
}

async function resolveEventFilter(requestedEventId: string | null, companyId: string | null) {
  if (!requestedEventId) return null;
  const filters = [eq(event.id, requestedEventId)];
  if (companyId) filters.push(eq(event.companyId, companyId));
  const [row] = await db.select({ id: event.id }).from(event).where(and(...filters));
  return row?.id ?? null;
}

function actorMatches(pattern: string) {
  return or(
    sql`${auditLog.actorName} ILIKE ${pattern} ESCAPE '\\'`,
    sql`${user.email} ILIKE ${pattern} ESCAPE '\\'`,
  );
}

function isAuditAction(value: string): value is AuditAction {
  return AUDIT_ACTIONS.some((action) => action === value);
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}

function pushText(parts: string[], value: string | number | boolean | null | undefined) {
  if (typeof value === "string" && value.trim().length > 0) parts.push(value.trim());
}
