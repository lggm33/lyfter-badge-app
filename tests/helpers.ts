import { POST as authPost } from "@/app/api/auth/[...all]/route";

export function cookieHeader(response: Response) {
  const responseHeaders = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const cookies = responseHeaders.getSetCookie?.() ??
    response.headers.get("set-cookie")?.split(/,(?=[^;,]+=)/) ?? [];

  return cookies.map((cookie) => cookie.split(";", 1)[0]).join("; ");
}

export async function postAuth(
  path: string,
  body: Record<string, unknown>,
  cookie?: string,
) {
  return authPost(
    new Request(`http://localhost:3000/api/auth${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "http://localhost:3000",
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify(body),
    }),
  );
}

export function requireTestEnv() {
  for (const key of ["DATABASE_URL", "BETTER_AUTH_SECRET"]) {
    if (!process.env[key]) {
      throw new Error(`${key} must be set to run the Railway integration test`);
    }
  }
}

/** Minúsculas siempre: Better Auth normaliza el email antes de persistirlo. */
export function uniqueEmail(prefix: string) {
  return `vitest-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`
    .toLowerCase();
}
