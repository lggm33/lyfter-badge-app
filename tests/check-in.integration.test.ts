import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { checkIn } from "@/app/lib/check-in";
import { QR_GRACE_WINDOWS, QR_WINDOW_SECONDS, signQrToken } from "@/app/lib/qr-token";
import { accountChoiceLinks, scanNextPath } from "@/app/lib/scan-next";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { company, event, eventMembership } from "@/db/schema";
import { postAuth, requireTestEnv, uniqueEmail } from "./helpers";

const password = "integration-test-password";
const emailA = uniqueEmail("checkin-a");
const emailB = uniqueEmail("checkin-b");
const companyId = randomUUID();

let userA = "";
let userB = "";

function shift(windows: number) {
  return new Date(Date.now() + windows * QR_WINDOW_SECONDS * 1000);
}

async function insertEvent(status: string, startsAt: Date, endsAt: Date, name = "Demo Day") {
  const id = randomUUID();
  await db.insert(event).values({
    id,
    companyId,
    name,
    slug: `evt-${id}`,
    startsAt,
    endsAt,
    status,
  });
  return id;
}

async function memberships(eventId: string, userId: string) {
  return db
    .select()
    .from(eventMembership)
    .where(and(eq(eventMembership.eventId, eventId), eq(eventMembership.userId, userId)));
}

describe("check-in", () => {
  beforeAll(async () => {
    requireTestEnv();
    if (!process.env.QR_SECRET) throw new Error("QR_SECRET must be set to run the check-in test");

    const signUpA = await postAuth("/sign-up/email", { name: "Check-in A", email: emailA, password });
    const signUpB = await postAuth("/sign-up/email", { name: "Check-in B", email: emailB, password });
    expect(signUpA.status).toBe(200);
    expect(signUpB.status).toBe(200);
    userA = (await signUpA.json()).user.id;
    userB = (await signUpB.json()).user.id;

    await db.insert(company).values({ id: companyId, name: "Check-in Co", slug: `checkin-${companyId}` });
  });

  afterAll(async () => {
    await db.delete(company).where(eq(company.id, companyId));
    await db.delete(user).where(eq(user.email, emailA));
    await db.delete(user).where(eq(user.email, emailB));
  });

  it("crea una fila en el primer check-in y no la duplica", async () => {
    const eventId = await insertEvent("ACTIVE", shift(-1), shift(60 * 60 / QR_WINDOW_SECONDS));
    const firstToken = signQrToken({ kind: "checkin", subjectId: eventId });
    const secondToken = signQrToken({ kind: "checkin", subjectId: eventId }, shift(-1));

    const first = await checkIn(firstToken, userA);
    const [row] = await memberships(eventId, userA);
    const second = await checkIn(secondToken, userA);
    const rows = await memberships(eventId, userA);

    expect(first).toMatchObject({ ok: true, outcome: "checked_in", eventId, eventName: "Demo Day" });
    expect(second).toMatchObject({ ok: true, outcome: "already_checked_in", eventId });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.checkedInAt).toEqual(row?.checkedInAt);
  });

  it("dos llamados en paralelo dejan una sola fila", async () => {
    const eventId = await insertEvent("ACTIVE", shift(-1), shift(120));
    const token = signQrToken({ kind: "checkin", subjectId: eventId });

    const results = await Promise.all([checkIn(token, userA), checkIn(token, userA)]);
    const rows = await memberships(eventId, userA);

    expect(results.map((result) => result.ok && result.outcome).sort()).toEqual([
      "already_checked_in",
      "checked_in",
    ]);
    expect(rows).toHaveLength(1);
  });

  it("rechaza token inválido, vencido o de badge sin escribir", async () => {
    const eventId = await insertEvent("ACTIVE", shift(-1), shift(120));
    const valid = signQrToken({ kind: "checkin", subjectId: eventId });
    const [kind, subjectId, window, signature] = valid.split(".");
    const flipped = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    const expired = signQrToken({ kind: "checkin", subjectId: eventId }, shift(-(QR_GRACE_WINDOWS + 2)));
    const badge = signQrToken({ kind: "badge", subjectId: "badge-1" });

    await expect(checkIn(`${kind}.${subjectId}.${window}.${flipped}`, userA)).resolves.toEqual({ ok: false, reason: "invalid" });
    await expect(checkIn("no-es-un-token", userA)).resolves.toEqual({ ok: false, reason: "invalid" });
    await expect(checkIn(expired, userA)).resolves.toEqual({ ok: false, reason: "expired" });
    await expect(checkIn(badge, userA)).resolves.toEqual({ ok: false, reason: "not_checkin" });
    await expect(memberships(eventId, userA)).resolves.toHaveLength(0);
  });

  it("rechaza eventos cerrados o inexistentes", async () => {
    const draftId = await insertEvent("DRAFT", shift(10), shift(20));
    const finishedId = await insertEvent("FINISHED", shift(-20), shift(20));
    const endedId = await insertEvent("ACTIVE", shift(-40), shift(-1));
    const missingId = randomUUID();

    for (const eventId of [draftId, finishedId, endedId, missingId]) {
      const token = signQrToken({ kind: "checkin", subjectId: eventId });
      await expect(checkIn(token, userA)).resolves.toEqual({ ok: false, reason: "event_closed" });
      await expect(memberships(eventId, userA)).resolves.toHaveLength(0);
    }
  });

  it("acepta un evento ACTIVE que todavía no empezó", async () => {
    const eventId = await insertEvent("ACTIVE", shift(60), shift(120), "Antes de empezar");
    const token = signQrToken({ kind: "checkin", subjectId: eventId });

    await expect(checkIn(token, userA)).resolves.toMatchObject({
      ok: true,
      outcome: "checked_in",
      eventName: "Antes de empezar",
    });
  });

  it("no escribe si no hay sesión", async () => {
    const eventId = await insertEvent("ACTIVE", shift(-1), shift(120));
    const token = signQrToken({ kind: "checkin", subjectId: eventId });

    await expect(checkIn(token, null)).resolves.toEqual({ ok: false, reason: "unauthenticated" });
    await expect(memberships(eventId, userA)).resolves.toHaveLength(0);
  });

  it("deja una fila por usuario en el mismo evento", async () => {
    const eventId = await insertEvent("ACTIVE", shift(-1), shift(120));
    const token = signQrToken({ kind: "checkin", subjectId: eventId });

    await expect(checkIn(token, userA)).resolves.toMatchObject({ outcome: "checked_in" });
    await expect(checkIn(token, userB)).resolves.toMatchObject({ outcome: "checked_in" });

    const rows = await db.select().from(eventMembership).where(eq(eventMembership.eventId, eventId));
    expect(rows).toHaveLength(2);
  });

  it("acepta el token dentro de una URL /scan", async () => {
    const eventId = await insertEvent("ACTIVE", shift(-1), shift(120), "Desde URL");
    const token = signQrToken({ kind: "checkin", subjectId: eventId });

    await expect(checkIn(`https://lyfter.test/scan?t=${encodeURIComponent(token)}`, userA)).resolves.toMatchObject({
      outcome: "checked_in",
      eventName: "Desde URL",
    });
  });

  it("ignora un next que no vuelve a /scan", () => {
    expect(scanNextPath("/admin")).toBe("/home");
    expect(scanNextPath("//evil.example/scan")).toBe("/home");
    expect(scanNextPath("https://evil.example/scan?t=1")).toBe("/home");
    expect(scanNextPath("/scan?t=abc")).toBe("/scan?t=abc");
    expect(scanNextPath("/scan")).toBe("/scan");
    expect(accountChoiceLinks("abc")).toEqual({
      login: "/login?next=%2Fscan%3Ft%3Dabc",
      register: "/register?next=%2Fscan%3Ft%3Dabc",
    });
  });
});
