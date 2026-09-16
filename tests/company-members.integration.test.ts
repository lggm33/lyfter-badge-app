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
  assignCompanyAdmin,
  getCompany,
  listCompanyMembers,
  removeCompanyMember,
  searchAssignableUsers,
} from "@/app/(protected)/admin/companies/actions";
import { getMyCompany } from "@/app/(protected)/company/[companyId]/actions";
import { listMyCompanies } from "@/app/(protected)/home/actions";
import {
  getGlobalRole,
  requireCompanyAccess,
  requireCompanyMembership,
} from "@/app/lib/authz";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { company } from "@/db/schema";
import { seedSuperAdmin } from "@/db/seed";
import { cookieHeader, postAuth, requireTestEnv, uniqueEmail } from "./helpers";

const password = "integration-test-password";
const memberEmail = uniqueEmail("members-target");
const adminEmail = uniqueEmail("members-admin");
const companyId = randomUUID();
const otherCompanyId = randomUUID();

let memberId: string;
let memberCookie: string;
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

function assignForm(userId: string) {
  const form = new FormData();
  form.set("companyId", companyId);
  form.set("userId", userId);
  return form;
}

function removeForm(memberRowId: string) {
  const form = new FormData();
  form.set("companyId", companyId);
  form.set("memberId", memberRowId);
  return form;
}

describe("company members integration", () => {
  beforeAll(async () => {
    requireTestEnv();

    const signUp = await postAuth("/sign-up/email", {
      name: "Vitest Member",
      email: memberEmail,
      password,
    });
    expect(signUp.status).toBe(200);
    memberId = (await signUp.json()).user.id;
    memberCookie = await signIn(memberEmail);

    const seeded = await seedSuperAdmin({
      email: adminEmail,
      password,
      name: "Vitest Members Admin",
    });
    expect(seeded.created).toBe(true);
    adminId = seeded.id;
    adminCookie = await signIn(adminEmail);

    await db.insert(company).values([
      { id: companyId, name: "Vitest Members Co", slug: `members-${companyId}` },
      { id: otherCompanyId, name: "Vitest Other Co", slug: `other-${otherCompanyId}` },
    ]);
  });

  // Borrar las empresas arrastra `company_member` por el ON DELETE CASCADE.
  afterAll(async () => {
    try {
      await db.delete(user).where(inArray(user.email, [memberEmail, adminEmail]));
    } finally {
      await db
        .delete(company)
        .where(inArray(company.id, [companyId, otherCompanyId]));
    }
  });

  it("sin sesión no se entra al panel de empresa", async () => {
    withCookie();
    await expect(requireCompanyMembership(companyId)).rejects.toThrow(
      "REDIRECT:/login",
    );

    withCookie();
    await expect(getMyCompany(companyId)).rejects.toThrow("REDIRECT:/login");
  });

  it("SUPER_ADMIN sin membresía no entra al panel de empresa", async () => {
    withCookie(adminCookie);
    await expect(requireCompanyMembership(companyId)).rejects.toThrow(
      "REDIRECT:/home",
    );

    withCookie(adminCookie);
    await expect(getMyCompany(companyId)).rejects.toThrow("REDIRECT:/home");
  });

  it("un PARTICIPANT no puede leer ni asignar membresías", async () => {
    withCookie(memberCookie);
    await expect(getCompany(companyId)).rejects.toThrow("REDIRECT:/home");

    withCookie(memberCookie);
    await expect(listCompanyMembers(companyId)).rejects.toThrow("REDIRECT:/home");

    withCookie(memberCookie);
    await expect(assignCompanyAdmin(assignForm(memberId))).rejects.toThrow(
      "REDIRECT:/home",
    );

    withCookie(memberCookie);
    await expect(searchAssignableUsers("vi", companyId)).rejects.toThrow(
      "REDIRECT:/home",
    );

    withCookie(adminCookie);
    await expect(listCompanyMembers(companyId)).resolves.toEqual([]);
  });

  it("sin filtro lista hasta 20 usuarios ordenados por nombre", async () => {
    withCookie(adminCookie);
    const browse = await searchAssignableUsers("", companyId);

    expect(browse.users.length).toBeLessThanOrEqual(20);
    const names = browse.users.map((item) => item.name.toLocaleLowerCase("en"));
    expect(names).toEqual([...names].sort((left, right) => left.localeCompare(right, "en")));
  });

  it("el admin encuentra por nombre o email", async () => {
    withCookie(adminCookie);
    const byEmail = await searchAssignableUsers(memberEmail.slice(0, 18), companyId);
    expect(byEmail.users).toEqual(
      expect.arrayContaining([
        {
          id: memberId,
          name: "Vitest Member",
          email: memberEmail,
          alreadyAdmin: false,
        },
      ]),
    );

    withCookie(adminCookie);
    const byName = await searchAssignableUsers("Vitest Member", companyId);
    expect(byName.users.some((item) => item.id === memberId)).toBe(true);
  });

  it("rechaza un userId inexistente y no crea la cuenta", async () => {
    const ghostId = randomUUID();

    withCookie(adminCookie);
    await expect(assignCompanyAdmin(assignForm(ghostId))).rejects.toThrow(
      "No existe un usuario registrado con ese identificador.",
    );

    const rows = await db.select({ id: user.id }).from(user).where(eq(user.id, ghostId));
    expect(rows).toEqual([]);
  });

  it("asigna por userId, sin duplicar ni tocar el rol global", async () => {
    withCookie(adminCookie);
    await expect(assignCompanyAdmin(assignForm(memberId))).rejects.toThrow(
      `REDIRECT:/admin/companies/${companyId}`,
    );

    withCookie(adminCookie);
    await expect(assignCompanyAdmin(assignForm(memberId))).rejects.toThrow(
      `REDIRECT:/admin/companies/${companyId}`,
    );

    withCookie(adminCookie);
    await expect(listCompanyMembers(companyId)).resolves.toEqual([
      {
        id: expect.any(String),
        userId: memberId,
        name: "Vitest Member",
        email: memberEmail,
        role: "COMPANY_ADMIN",
      },
    ]);

    await expect(getGlobalRole(memberId)).resolves.toBe("PARTICIPANT");
    await expect(getGlobalRole(adminId)).resolves.toBe("SUPER_ADMIN");

    withCookie(adminCookie);
    const afterAssign = await searchAssignableUsers(memberEmail.slice(0, 18), companyId);
    expect(afterAssign.users.find((item) => item.id === memberId)?.alreadyAdmin).toBe(
      true,
    );
  });

  it("la membresía habilita su empresa y ninguna otra", async () => {
    withCookie(memberCookie);
    await expect(requireCompanyAccess(companyId)).resolves.toMatchObject({
      user: { id: memberId },
    });

    withCookie(memberCookie);
    await expect(requireCompanyMembership(companyId)).resolves.toMatchObject({
      user: { id: memberId },
    });

    withCookie(memberCookie);
    await expect(getMyCompany(companyId)).resolves.toMatchObject({
      id: companyId,
      name: "Vitest Members Co",
    });

    withCookie(memberCookie);
    await expect(requireCompanyAccess(otherCompanyId)).rejects.toThrow(
      "REDIRECT:/home",
    );

    withCookie(memberCookie);
    await expect(requireCompanyMembership(otherCompanyId)).rejects.toThrow(
      "REDIRECT:/home",
    );

    withCookie(memberCookie);
    await expect(getMyCompany(otherCompanyId)).rejects.toThrow("REDIRECT:/home");
  });

  it("home lista solo las empresas del usuario, aunque tenga más de una", async () => {
    withCookie();
    await expect(listMyCompanies()).rejects.toThrow("REDIRECT:/login");

    withCookie(adminCookie);
    await expect(listMyCompanies()).resolves.toEqual([]);

    withCookie(memberCookie);
    await expect(listMyCompanies()).resolves.toEqual([
      { id: companyId, name: "Vitest Members Co" },
    ]);

    const otherForm = new FormData();
    otherForm.set("companyId", otherCompanyId);
    otherForm.set("userId", memberId);
    withCookie(adminCookie);
    await expect(assignCompanyAdmin(otherForm)).rejects.toThrow(
      `REDIRECT:/admin/companies/${otherCompanyId}`,
    );

    withCookie(memberCookie);
    await expect(listMyCompanies()).resolves.toEqual([
      { id: companyId, name: "Vitest Members Co" },
      { id: otherCompanyId, name: "Vitest Other Co" },
    ]);
  });

  it("quitar la membresía corta el acceso", async () => {
    withCookie(adminCookie);
    const [member] = await listCompanyMembers(companyId);

    withCookie(memberCookie);
    await expect(removeCompanyMember(removeForm(member.id))).rejects.toThrow(
      "REDIRECT:/home",
    );

    withCookie(adminCookie);
    await expect(removeCompanyMember(removeForm(member.id))).rejects.toThrow(
      `REDIRECT:/admin/companies/${companyId}`,
    );

    withCookie(memberCookie);
    await expect(requireCompanyAccess(companyId)).rejects.toThrow("REDIRECT:/home");

    withCookie(memberCookie);
    await expect(getMyCompany(companyId)).rejects.toThrow("REDIRECT:/home");
  });
});
