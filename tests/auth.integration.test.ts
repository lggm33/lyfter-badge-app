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

import { auth } from "@/app/lib/auth";
import { user } from "@/auth-schema";
import { db } from "@/db";
import HomePage from "@/app/(protected)/home/page";
import ProtectedLayout from "@/app/(protected)/layout";
import { cookieHeader, postAuth, requireTestEnv, uniqueEmail } from "./helpers";

const email = uniqueEmail("auth");
const password = "integration-test-password";
let userId: string | undefined;

describe("auth integration", () => {
  beforeAll(requireTestEnv);

  // Por email, no por id: si el test falla antes de capturar el id, igual limpia.
  afterAll(async () => {
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
    // El rol no se expone al cliente; vive solo en la DB.
    expect(signUpPayload.user).not.toHaveProperty("role");

    const [persisted] = await db
      .select({ role: user.role })
      .from(user)
      .where(eq(user.id, userId!));
    expect(persisted.role).toBe("PARTICIPANT");

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
