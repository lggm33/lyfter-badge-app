import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";

const headersMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  }),
);
const routerMock = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  useRouter: vi.fn(() => routerMock),
}));

import { POST as authPost } from "@/app/api/auth/[...all]/route";
import { auth } from "@/app/lib/auth";
import { user } from "@/auth-schema";
import { db } from "@/db";
import HomePage from "@/app/(protected)/home/page";
import ProtectedLayout from "@/app/(protected)/layout";

const email = `vitest-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
const password = "integration-test-password";
let userId: string | undefined;

function cookieHeader(response: Response) {
  const responseHeaders = response.headers as Headers & {
    getSetCookie?: () => string[];
  };
  const cookies = responseHeaders.getSetCookie?.() ??
    response.headers.get("set-cookie")?.split(/,(?=[^;,]+=)/) ?? [];

  return cookies.map((cookie) => cookie.split(";", 1)[0]).join("; ");
}

async function postAuth(path: string, body: Record<string, unknown>, cookie?: string) {
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

describe("auth integration", () => {
  beforeAll(() => {
    for (const key of ["DATABASE_URL", "BETTER_AUTH_SECRET"]) {
      if (!process.env[key]) {
        throw new Error(`${key} must be set to run the Railway integration test`);
      }
    }
  });

  afterAll(async () => {
    if (userId) {
      await db.delete(user).where(eq(user.id, userId));
      return;
    }

    await db.delete(user).where(eq(user.email, email));
  });

  it("runs signup, signin, protected home, and signout end to end", async () => {
    const signUpResponse = await postAuth("/sign-up/email", {
      name: "Vitest Integration User",
      email,
      password,
    });
    expect(signUpResponse.status).toBe(200);

    const signUpPayload = await signUpResponse.json();
    userId = signUpPayload.user.id;
    expect(signUpPayload.user.role).toBe("PARTICIPANT");

    const signInResponse = await postAuth("/sign-in/email", { email, password });
    expect(signInResponse.status).toBe(200);
    const signInPayload = await signInResponse.json();
    expect(signInPayload.user.id).toBe(userId);

    const sessionCookie = cookieHeader(signInResponse);
    const session = await auth.api.getSession({
      headers: new Headers({ cookie: sessionCookie }),
    });
    expect(session?.user.id).toBe(userId);

    headersMock.mockResolvedValueOnce(new Headers());
    await expect(
      ProtectedLayout({ children: "protected" }),
    ).rejects.toThrow("REDIRECT:/login");

    headersMock.mockResolvedValueOnce(new Headers({ cookie: sessionCookie }));
    await expect(
      ProtectedLayout({ children: "protected" }),
    ).resolves.toBe("protected");

    headersMock.mockResolvedValueOnce(new Headers({ cookie: sessionCookie }));
    const homeMarkup = renderToStaticMarkup(await HomePage());
    expect(homeMarkup).toContain("Hola, Vitest Integration User");

    const signOutResponse = await postAuth("/sign-out", {}, sessionCookie);
    expect(signOutResponse.status).toBe(200);
    await expect(
      auth.api.getSession({
        headers: new Headers({ cookie: sessionCookie }),
      }),
    ).resolves.toBeNull();
  });
});
