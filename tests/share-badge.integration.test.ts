import { randomUUID } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";

const headersMock = vi.hoisted(() => vi.fn());
vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT:${path}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

import ShareBadgePage from "@/app/share/[redemptionId]/page";
import { getMyBadge } from "@/app/(protected)/home/actions";
import { loadShareCard } from "@/app/lib/share-badge";
import { db } from "@/db";
import { badge, badgeRedemption, company, event } from "@/db/schema";
import { cookieHeader, postAuth, requireTestEnv, uniqueEmail } from "./helpers";

const password = "integration-test-password";
const email = uniqueEmail("share");
const companyId = randomUUID();
const eventId = randomUUID();
const badgeId = randomUUID();
const redemptionId = randomUUID();

describe("public share card", () => {
  beforeAll(async () => {
    requireTestEnv();
    const signUp = await postAuth("/sign-up/email", { name: "Ada Lovelace", email, password });
    expect(signUp.status).toBe(200);
    const userId = (await signUp.json()).user.id;
    const signIn = await postAuth("/sign-in/email", { email, password });
    headersMock.mockResolvedValue(new Headers({ cookie: cookieHeader(signIn) }));

    await db.insert(company).values({ id: companyId, name: "Share Co", slug: `share-${companyId}` });
    await db.insert(event).values({
      id: eventId,
      companyId,
      name: "Demo Day",
      slug: `evt-${eventId}`,
      startsAt: new Date(),
      endsAt: new Date(Date.now() + 60 * 60 * 1000),
      status: "ACTIVE",
    });
    await db.insert(badge).values({
      id: badgeId,
      eventId,
      name: "Charla de apertura",
      type: "CONTENT",
      rarity: "COMMON",
      icon: "🎤",
      xp: 100,
    });
    await db.insert(badgeRedemption).values({ id: redemptionId, badgeId, eventId, userId });
  });

  it("returns the name, badge, event and that badge XP", async () => {
    await expect(loadShareCard(redemptionId)).resolves.toEqual({
      name: "Ada Lovelace",
      badgeName: "Charla de apertura",
      icon: "🎤",
      eventName: "Demo Day",
      xp: 100,
    });
  });

  it("returns nothing for an unknown redemption", async () => {
    await expect(loadShareCard(randomUUID())).resolves.toBeNull();
  });

  it("renders the public page without a session and keeps the email off it", async () => {
    headersMock.mockResolvedValue(new Headers());
    const page = await ShareBadgePage({ params: Promise.resolve({ redemptionId }) });
    const html = renderToStaticMarkup(page);

    expect(html).toContain("Ada Lovelace");
    expect(html).toContain("obtuvo Charla de apertura y 100 XP.");
    expect(html).toContain("Demo Day");
    expect(html).not.toContain(email);
  });

  it("still requires a session on the private badge page", async () => {
    headersMock.mockResolvedValue(new Headers());
    await expect(getMyBadge(badgeId)).rejects.toThrow("REDIRECT:/login");
  });
});
