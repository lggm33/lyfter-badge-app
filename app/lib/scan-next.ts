const SCAN_PAGE = "/scan";

/**
 * Only a same-origin /scan path may be used as a post-auth return.
 * Anything else, including protocol-relative URLs, goes home.
 */
export function scanNextPath(next: string | null | undefined) {
  if (!next || next.startsWith("//") || next.includes("://") || next.includes("\\")) {
    return "/home";
  }

  if (next === SCAN_PAGE || next.startsWith(`${SCAN_PAGE}?`)) {
    return next;
  }

  return "/home";
}

export function loginPathForScan(token: string) {
  const next = `${SCAN_PAGE}?t=${encodeURIComponent(token)}`;
  return `/login?next=${encodeURIComponent(next)}`;
}
