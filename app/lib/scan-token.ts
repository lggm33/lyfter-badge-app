/** Accepts a raw token or a /scan URL that carries ?t=. */
export function extractScanToken(input: string) {
  const trimmed = input.trim();
  const fromQuery = tokenFromScanUrl(trimmed);
  if (fromQuery) return fromQuery;
  return trimmed;
}

function tokenFromScanUrl(value: string) {
  if (value.startsWith("/scan?") || value.startsWith("scan?")) {
    const query = value.slice(value.indexOf("?") + 1);
    return new URLSearchParams(query).get("t");
  }

  try {
    const url = new URL(value);
    if (url.pathname === "/scan" || url.pathname.endsWith("/scan")) {
      return url.searchParams.get("t");
    }
  } catch {
    return null;
  }

  return null;
}
