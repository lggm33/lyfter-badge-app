import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";

const headersMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() =>
  vi.fn((path: string): never => {
    throw new Error(`REDIRECT:${path}`);
  }),
);

vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import {
  getGlobalRole,
  requireCompanyAccess,
  requireRole,
  requireSession,
} from "@/app/lib/authz";
import { createCompany } from "@/app/(protected)/admin/companies/actions";
import { isSuperAdmin } from "@/app/(auth)/admin/login/actions";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { company, companyMember } from "@/db/schema";
import { seedSuperAdmin } from "@/db/seed";
import { cookieHeader, postAuth, requireTestEnv, uniqueEmail } from "./helpers";

const password = "integration-test-password";
const participantEmail = uniqueEmail("authz-participant");
const adminEmail = uniqueEmail("authz-admin");
const companyId = randomUUID();

let participantId: string;
let participantCookie: string;
let adminId: string;
let adminCookie: string;

async function signIn(email: string) {
  const response = await postAuth("/sign-in/email", { email, password });
  expect(response.status).toBe(200);
  return cookieHeader(response);
}

/** Cada helper de authz consume exactamente un `headers()`. */
function withCookie(cookie?: string) {
  headersMock.mockResolvedValueOnce(
    new Headers(cookie ? { cookie } : undefined),
  );
}

describe("authz integration", () => {
  beforeAll(async () => {
    requireTestEnv();

    const signUp = await postAuth("/sign-up/email", {
      name: "Vitest Participant",
      email: participantEmail,
      password,
    });
    expect(signUp.status).toBe(200);
    participantId = (await signUp.json()).user.id;
    participantCookie = await signIn(participantEmail);

    const seeded = await seedSuperAdmin({
      email: adminEmail,
      password,
      name: "Vitest Super Admin",
    });
    expect(seeded.created).toBe(true);
    adminId = seeded.id;
    adminCookie = await signIn(adminEmail);

    await db.insert(company).values({
      id: companyId,
      name: "Vitest Company",
      slug: `vitest-${companyId}`,
    });
  });

  // Por email y siempre: los ids pueden no haberse capturado si beforeAll falló,
  // y la empresa debe borrarse aunque el borrado de usuarios reviente.
  afterAll(async () => {
    try {
      await db
        .delete(user)
        .where(inArray(user.email, [participantEmail, adminEmail]));
    } finally {
      await db.delete(company).where(eq(company.id, companyId));
    }
  });

  it("redirige al login cuando no hay sesión", async () => {
    withCookie();
    await expect(requireSession()).rejects.toThrow("REDIRECT:/login");
  });

  it("devuelve la sesión cuando la cookie es válida", async () => {
    withCookie(participantCookie);
    await expect(requireSession()).resolves.toMatchObject({
      user: { id: participantId },
    });
  });

  it("asigna el rol global desde la base, no desde la sesión", async () => {
    await expect(getGlobalRole(participantId)).resolves.toBe("PARTICIPANT");
    await expect(getGlobalRole(adminId)).resolves.toBe("SUPER_ADMIN");
  });

  it("requireRole bloquea a un participante en rutas de SUPER_ADMIN", async () => {
    withCookie(participantCookie);
    await expect(requireRole("SUPER_ADMIN")).rejects.toThrow("REDIRECT:/home");

    withCookie(adminCookie);
    await expect(requireRole("SUPER_ADMIN")).resolves.toMatchObject({
      user: { id: adminId },
    });
  });

  it("requireCompanyAccess exige membresía y deja pasar al SUPER_ADMIN", async () => {
    withCookie(participantCookie);
    await expect(requireCompanyAccess(companyId)).rejects.toThrow(
      "REDIRECT:/home",
    );

    // SUPER_ADMIN tiene alcance global sin estar en company_member.
    withCookie(adminCookie);
    await expect(requireCompanyAccess(companyId)).resolves.toMatchObject({
      user: { id: adminId },
    });

    await db.insert(companyMember).values({
      id: randomUUID(),
      companyId,
      userId: participantId,
      role: "COMPANY_ADMIN",
    });

    withCookie(participantCookie);
    await expect(requireCompanyAccess(companyId)).resolves.toMatchObject({
      user: { id: participantId },
    });
  });

  it("seedSuperAdmin es idempotente", async () => {
    const again = await seedSuperAdmin({ email: adminEmail, password });
    expect(again).toEqual({ id: adminId, email: adminEmail, created: false });

    const rows = await db
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(eq(user.email, adminEmail));
    expect(rows).toEqual([{ id: adminId, role: "SUPER_ADMIN" }]);
  });

  it("seedSuperAdmin normaliza el email y no duplica con mayúsculas", async () => {
    const mixedCase = await seedSuperAdmin({
      email: adminEmail.toUpperCase(),
      password,
    });
    // El email vuelve normalizado, no como se pasó.
    expect(mixedCase).toEqual({ id: adminId, email: adminEmail, created: false });

    const rows = await db
      .select({ id: user.id })
      .from(user)
      .where(eq(user.email, adminEmail));
    expect(rows).toHaveLength(1);
  });

  it("seedSuperAdmin no promueve una cuenta existente sin la contraseña correcta", async () => {
    await expect(
      seedSuperAdmin({ email: participantEmail, password: "password-incorrecta" }),
    ).rejects.toThrow(/no se promueve a SUPER_ADMIN/);

    await expect(getGlobalRole(participantId)).resolves.toBe("PARTICIPANT");
  });

  it("solo SUPER_ADMIN puede crear empresas y el slug es único", async () => {
    const slug = `company-${randomUUID()}`;
    const form = new FormData();
    form.set("name", "Created Company");
    form.set("slug", slug);

    try {
      withCookie(participantCookie);
      await expect(createCompany(form)).rejects.toThrow("REDIRECT:/home");

      withCookie(adminCookie);
      await expect(createCompany(form)).rejects.toThrow("REDIRECT:/admin/companies");

      withCookie(adminCookie);
      await expect(createCompany(form)).rejects.toThrow("Ya existe una empresa");
    } finally {
      await db.delete(company).where(eq(company.slug, slug));
    }
  });

  it("el acceso administrativo solo acepta SUPER_ADMIN", async () => {
    withCookie(participantCookie);
    await expect(isSuperAdmin()).resolves.toBe(false);

    withCookie(adminCookie);
    await expect(isSuperAdmin()).resolves.toBe(true);
  });

  it("seedSuperAdmin promueve un usuario existente que no era SUPER_ADMIN", async () => {
    const promoted = await seedSuperAdmin({
      email: participantEmail,
      password,
    });
    expect(promoted).toEqual({
      id: participantId,
      email: participantEmail,
      created: false,
    });
    await expect(getGlobalRole(participantId)).resolves.toBe("SUPER_ADMIN");
  });
});
