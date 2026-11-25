import { sql } from "drizzle-orm";
import { buildUserSearchPattern } from "@/app/lib/user-search";
import { db } from "@/db";

export const DIRECTORY_PAGE_SIZE = 50;

export type DirectoryQuery = {
  search: string;
  page: number;
};

export type DirectoryRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  companies: string;
  createdAt: Date;
  disabledAt: Date | null;
};

export type DirectoryPage = {
  rows: DirectoryRow[];
  hasNextPage: boolean;
  search: string;
  searchTooShort: boolean;
  page: number;
};

type SearchValue = string | string[] | undefined;

/**
 * User list for the Super Admin. A one-character search is ignored
 * and the full page stays visible, same as the audit actor filter.
 */
export async function listUserDirectory(query: DirectoryQuery): Promise<DirectoryPage> {
  const trimmed = query.search.trim();
  const pattern = buildUserSearchPattern(trimmed);
  const offset = (query.page - 1) * DIRECTORY_PAGE_SIZE;
  const where = pattern
    ? sql`(u.name ILIKE ${pattern} ESCAPE '\\' OR u.email ILIKE ${pattern} ESCAPE '\\')`
    : sql`true`;
  const result = await db.execute<{
    id: string;
    name: string;
    email: string;
    role: string;
    companies: string;
    createdAt: Date | string;
    disabledAt: Date | string | null;
  }>(sql`
    SELECT u.id,
           u.name,
           u.email,
           u.role,
           coalesce((
             SELECT string_agg(c.name, ', ' ORDER BY c.name)
             FROM company_member m
             JOIN company c ON c.id = m.company_id
             WHERE m.user_id = u.id AND m.role = 'COMPANY_ADMIN'
           ), '') AS companies,
           u.created_at AS "createdAt",
           u.disabled_at AS "disabledAt"
    FROM "user" u
    WHERE ${where}
    ORDER BY u.created_at DESC, u.id ASC
    LIMIT ${DIRECTORY_PAGE_SIZE + 1}
    OFFSET ${offset}
  `);

  const hasNextPage = result.rows.length > DIRECTORY_PAGE_SIZE;
  const visible = hasNextPage ? result.rows.slice(0, DIRECTORY_PAGE_SIZE) : result.rows;

  return {
    rows: visible.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      companies: row.companies,
      createdAt: row.createdAt instanceof Date ? row.createdAt : new Date(row.createdAt),
      disabledAt: row.disabledAt == null ? null : row.disabledAt instanceof Date ? row.disabledAt : new Date(row.disabledAt),
    })),
    hasNextPage,
    search: trimmed,
    searchTooShort: trimmed.length > 0 && pattern === null,
    page: query.page,
  };
}

export function parseDirectoryQuery(params: { q?: SearchValue; page?: SearchValue }): DirectoryQuery {
  const page = Number.parseInt(firstParam(params.page), 10);
  return {
    search: firstParam(params.q).trim(),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export function directoryRoleLabel(role: string) {
  if (role === "SUPER_ADMIN") return "Super Admin";
  if (role === "PARTICIPANT") return "Participante";
  return role;
}

function firstParam(value: SearchValue) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
