/** Tests and dev seeds write fake rows: they must never reach a shared database. */
export function assertLocalDatabase(url: string | undefined) {
  if (!url) throw new Error("DATABASE_URL is not set");

  const { hostname } = new URL(url);
  if (!["localhost", "127.0.0.1"].includes(hostname)) {
    throw new Error(`Refusing to write to non-local database host ${hostname}`);
  }

  return url;
}
