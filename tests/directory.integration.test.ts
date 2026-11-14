import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { inArray } from "drizzle-orm";

const headersMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn((path: string): never => {
  throw new Error(`REDIRECT:${path}`);
}));

vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

import AdminUsersPage from "@/app/(protected)/admin/users/page";
import { DIRECTORY_PAGE_SIZE, listUserDirectory } from "@/app/lib/user-directory";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { company, companyMember } from "@/db/schema";
import { seedSuperAdmin } from "@/db/seed";
import { cookieHeader, postAuth, requireTestEnv, uniqueEmail } from "./helpers";

const password = "integration-test-password";
const adminEmail = uniqueEmail("directory-admin");
const participantEmail = uniqueEmail("directory-participant");
const prefix = `dir${randomUUID().slice(0, 8)}`;
const companyId = randomUUID();
const people = Array.from({ length: DIRECTORY_PAGE_SIZE + 1 }, (_, index) => ({
  id: randomUUID(),
  name: `${prefix} ${String(index).padStart(2, "0")}`,
  email: uniqueEmail(`directory-${index}`),
  index,
}));

let adminCookie = "";
let participantCookie = "";

function withCookie(cookie?: string) {
  headersMock.mockResolvedValueOnce(new Headers(cookie ? { cookie } : undefined));
}

describe("user directory", () => {
  beforeAll(async () => {
    requireTestEnv();
    await seedSuperAdmin({ email: adminEmail, password, name: "Directory Super" });
    adminCookie = cookieHeader(await postAuth("/sign-in/email", { email: adminEmail, password }));
    const participantSignUp = await postAuth("/sign-up/email", { name: "Directory Participant", email: participantEmail, password });
    expect(participantSignUp.status).toBe(200);
    participantCookie = cookieHeader(await postAuth("/sign-in/email", { email: participantEmail, password }));

    await db.insert(user).values(people.map((person) => ({
      id: person.id,
      name: person.name,
      email: person.email,
      createdAt: new Date(Date.UTC(2026, 0, 1, 0, person.index)),
    })));
    await db.insert(company).values({ id: companyId, name: `Empresa ${prefix}`, slug: `directory-${companyId}` });
    const admin = people[DIRECTORY_PAGE_SIZE];
    await db.insert(companyMember).values({ id: randomUUID(), companyId, userId: admin.id, role: "COMPANY_ADMIN" });
  });

  afterAll(async () => {
    await db.delete(company).where(inArray(company.id, [companyId]));
    await db.delete(user).where(inArray(user.id, people.map((person) => person.id)));
    await db.delete(user).where(inArray(user.email, [adminEmail, participantEmail]));
  });

  it("pages a search without repeating and lists the companies someone administers", async () => {
    const first = await listUserDirectory({ search: prefix, page: 1 });
    const second = await listUserDirectory({ search: prefix, page: 2 });
    const newest = people[DIRECTORY_PAGE_SIZE];
    const oldest = people[0];

    expect(first.rows).toHaveLength(DIRECTORY_PAGE_SIZE);
    expect(first.hasNextPage).toBe(true);
    expect(first.searchTooShort).toBe(false);
    expect(first.rows[0]).toMatchObject({ id: newest.id, email: newest.email, role: "PARTICIPANT", companies: `Empresa ${prefix}` });
    expect(second.rows).toEqual([
      expect.objectContaining({ id: oldest.id, companies: "" }),
    ]);
    const seen = new Set([...first.rows, ...second.rows].map((row) => row.id));
    expect(seen.size).toBe(DIRECTORY_PAGE_SIZE + 1);

    const tooShort = await listUserDirectory({ search: "d", page: 1 });
    expect(tooShort.searchTooShort).toBe(true);
    expect(tooShort.rows.length).toBeGreaterThan(1);

    const miss = await listUserDirectory({ search: `${prefix}-missing`, page: 1 });
    expect(miss.rows).toEqual([]);
  });

  it("lets a super admin open the directory and sends a participant home", async () => {
    withCookie(participantCookie);
    await expect(AdminUsersPage({ searchParams: Promise.resolve({}) })).rejects.toThrow("REDIRECT:/home");

    withCookie(adminCookie);
    await expect(AdminUsersPage({ searchParams: Promise.resolve({ q: prefix }) })).resolves.toBeTruthy();
  });
});
