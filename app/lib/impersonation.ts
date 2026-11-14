import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const IMPERSONATION_COOKIE = "lyfter_impersonation";
export const IMPERSONATION_TTL_MS = 2 * 60 * 60 * 1000;

export type ImpersonationPayload = {
  companyId: string;
  actorId: string;
  exp: number;
};

export function signImpersonation(payload: ImpersonationPayload, secret: string) {
  const body = `${payload.companyId}.${payload.actorId}.${payload.exp}`;
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

/** Returns the payload when the signature matches and the cookie has not expired. */
export function verifyImpersonation(token: string, secret: string, now: number): ImpersonationPayload | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [companyId, actorId, expText, signature] = parts;
  if (!companyId || !actorId || !signature || companyId.includes(".") || actorId.includes(".")) return null;
  const exp = Number(expText);
  if (!Number.isSafeInteger(exp)) return null;

  const expected = createHmac("sha256", secret).update(`${companyId}.${actorId}.${expText}`).digest("base64url");
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  if (exp <= now) return null;
  return { companyId, actorId, exp };
}

export async function readRequestImpersonation(now = Date.now()) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) return null;

  let store;
  try {
    store = await cookies();
  } catch {
    return null;
  }

  const token = store.get(IMPERSONATION_COOKIE)?.value;
  if (!token) return null;
  return verifyImpersonation(token, secret, now);
}

export async function writeImpersonationCookie(token: string, expiresAtMs: number) {
  const store = await cookies();
  store.set(IMPERSONATION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(expiresAtMs),
  });
}

export async function clearImpersonationCookie() {
  const store = await cookies();
  store.delete(IMPERSONATION_COOKIE);
}
