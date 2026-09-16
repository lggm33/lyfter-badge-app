export const USER_SEARCH_MIN_LENGTH = 2;
export const USER_SEARCH_LIMIT = 20;
const USER_SEARCH_MAX_LENGTH = 80;

/**
 * Normalizes the typed query and builds an escaped ILIKE contains pattern.
 * Returns null when the query is too short to run against the database.
 */
export function buildUserSearchPattern(raw: string) {
  const query = raw.trim().slice(0, USER_SEARCH_MAX_LENGTH);

  if (query.length < USER_SEARCH_MIN_LENGTH) {
    return null;
  }

  const escaped = query.replace(/[\\%_]/g, "\\$&");
  return `%${escaped}%`;
}
