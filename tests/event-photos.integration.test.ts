import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";

const headersMock = vi.hoisted(() => vi.fn());
const redirectMock = vi.hoisted(() => vi.fn((path: string): never => { throw new Error(`REDIRECT:${path}`); }));
vi.mock("next/headers", () => ({ headers: headersMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

import { deleteEventPhoto, uploadEventPhoto } from "@/app/(protected)/company/[companyId]/actions";
import { listMyCollection } from "@/app/(protected)/home/actions";
import { setBlobStore, type BlobStore } from "@/app/lib/event-photos";
import { user } from "@/auth-schema";
import { db } from "@/db";
import { auditLog, company, companyMember, event, eventMembership, eventPhoto } from "@/db/schema";
import { cookieHeader, postAuth, requireTestEnv, uniqueEmail } from "./helpers";

const companyId = randomUUID();
const otherCompanyId = randomUUID();
const eventId = randomUUID();
const otherEventId = randomUUID();
const adminEmail = uniqueEmail("photo-admin");
const strangerEmail = uniqueEmail("photo-stranger");
const participantEmail = uniqueEmail("photo-participant");
const password = "integration-test-password";

let adminCookie = "";
let participantCookie = "";
let adminId = "";
let puts: string[] = [];
let deletes: string[] = [];

const store: BlobStore = {
  async put(pathname) {
    puts.push(pathname);
    return { url: `https://photos.public.blob.vercel-storage.com/${pathname}`, pathname };
  },
  async del(pathname) {
    deletes.push(pathname);
  },
};

function jpeg(size = 32) {
  const body = new ArrayBuffer(size);
  new Uint8Array(body).set([0xff, 0xd8, 0xff]);
  return body;
}

function photoForm(targetEventId: string, bytes: ArrayBuffer, alt = "Apertura") {
  const form = new FormData();
  form.set("companyId", companyId);
  form.set("eventId", targetEventId);
  form.set("alt", alt);
  form.set("photo", new File([bytes], "photo.jpg", { type: "image/jpeg" }));
  return form;
}

describe("event photos", () => {
  beforeAll(async () => {
    requireTestEnv();
    setBlobStore(() => store);
    const admin = await postAuth("/sign-up/email", { name: "Photo Admin", email: adminEmail, password });
    adminId = (await admin.json()).user.id;
    adminCookie = cookieHeader(await postAuth("/sign-in/email", { email: adminEmail, password }));
    const participant = await postAuth("/sign-up/email", { name: "Photo Guest", email: participantEmail, password });
    const participantId = (await participant.json()).user.id;
    participantCookie = cookieHeader(await postAuth("/sign-in/email", { email: participantEmail, password }));
    await postAuth("/sign-up/email", { name: "Photo Stranger", email: strangerEmail, password });

    await db.insert(company).values([
      { id: companyId, name: "Photo Co", slug: `photo-${companyId}` },
      { id: otherCompanyId, name: "Other Photo Co", slug: `other-photo-${otherCompanyId}` },
    ]);
    await db.insert(companyMember).values({ id: randomUUID(), companyId, userId: adminId, role: "COMPANY_ADMIN" });
    const startsAt = new Date(Date.now() + 60 * 60 * 1000);
    const endsAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await db.insert(event).values([
      { id: eventId, companyId, name: "Gallery", slug: "gallery", startsAt, endsAt },
      { id: otherEventId, companyId: otherCompanyId, name: "Foreign", slug: "foreign", startsAt, endsAt },
    ]);
    await db.insert(eventMembership).values({ id: randomUUID(), eventId, userId: participantId });
  });

  afterAll(async () => {
    setBlobStore(null);
    await db.delete(company).where(eq(company.id, companyId));
    await db.delete(company).where(eq(company.id, otherCompanyId));
    await db.delete(user).where(eq(user.email, adminEmail));
    await db.delete(user).where(eq(user.email, participantEmail));
    await db.delete(user).where(eq(user.email, strangerEmail));
  });

  it("stores a photo and an audit row for a company member", async () => {
    puts = [];
    headersMock.mockResolvedValue(new Headers({ cookie: adminCookie }));
    await expect(uploadEventPhoto(photoForm(eventId, jpeg()))).rejects.toThrow(`REDIRECT:/company/${companyId}#eventos`);
    expect(puts).toHaveLength(1);

    const [photo] = await db.select().from(eventPhoto).where(eq(eventPhoto.eventId, eventId));
    expect(photo.alt).toBe("Apertura");
    const [logged] = await db.select().from(auditLog).where(and(eq(auditLog.action, "photo.created"), eq(auditLog.resourceId, photo.id)));
    expect(logged.companyId).toBe(companyId);
    expect(logged.actorId).toBe(adminId);
  });

  it("does not store a file that is not an image, or a ninth photo", async () => {
    puts = [];
    headersMock.mockResolvedValue(new Headers({ cookie: adminCookie }));
    const notAnImage = new ArrayBuffer(4);
    new Uint8Array(notAnImage).set([1, 2, 3, 4]);
    await expect(uploadEventPhoto(photoForm(eventId, notAnImage))).resolves.toMatchObject({
      error: "La foto tiene que ser JPEG, PNG o WebP.",
    });
    expect(puts).toEqual([]);
    await expect(db.select().from(auditLog).where(and(eq(auditLog.companyId, companyId), eq(auditLog.action, "photo.created")))).resolves.toHaveLength(1);

    const existing = await db.select({ id: eventPhoto.id }).from(eventPhoto).where(eq(eventPhoto.eventId, eventId));
    await db.insert(eventPhoto).values(Array.from({ length: 8 - existing.length }, () => ({
      id: randomUUID(),
      eventId,
      blobPathname: `events/${eventId}/${randomUUID()}`,
      url: "https://photos.public.blob.vercel-storage.com/filler",
    })));
    await expect(uploadEventPhoto(photoForm(eventId, jpeg()))).resolves.toMatchObject({ error: "Este evento ya tiene 8 fotos." });
    expect(puts).toEqual([]);
  });

  it("refuses a photo for another company and for a signed-out visitor", async () => {
    puts = [];
    headersMock.mockResolvedValue(new Headers({ cookie: adminCookie }));
    const foreign = photoForm(otherEventId, jpeg());
    foreign.set("companyId", otherCompanyId);
    await expect(uploadEventPhoto(foreign)).rejects.toThrow("REDIRECT:/home");
    expect(puts).toEqual([]);

    headersMock.mockResolvedValue(new Headers());
    await expect(uploadEventPhoto(photoForm(eventId, jpeg()))).rejects.toThrow("REDIRECT:/login");
    expect(puts).toEqual([]);
  });

  it("shows the photo only to someone who checked in, then deletes it", async () => {
    headersMock.mockResolvedValue(new Headers({ cookie: participantCookie }));
    const participant = await listMyCollection();
    expect(participant.events.some((item) => item.photos.some((photo) => photo.alt === "Apertura"))).toBe(true);

    const stranger = await postAuth("/sign-in/email", { email: strangerEmail, password });
    headersMock.mockResolvedValue(new Headers({ cookie: cookieHeader(stranger) }));
    const hidden = await listMyCollection();
    expect(hidden.events.some((item) => item.photos.length > 0)).toBe(false);

    const [photo] = await db.select({ id: eventPhoto.id, pathname: eventPhoto.blobPathname }).from(eventPhoto).where(eq(eventPhoto.alt, "Apertura"));
    deletes = [];
    headersMock.mockResolvedValue(new Headers({ cookie: adminCookie }));
    const form = new FormData();
    form.set("companyId", companyId);
    form.set("eventId", eventId);
    form.set("photoId", photo.id);
    await expect(deleteEventPhoto(form)).rejects.toThrow(`REDIRECT:/company/${companyId}#eventos`);
    expect(deletes).toEqual([photo.pathname]);
    await expect(db.select().from(eventPhoto).where(eq(eventPhoto.id, photo.id))).resolves.toHaveLength(0);
    const [logged] = await db.select().from(auditLog).where(and(eq(auditLog.action, "photo.deleted"), eq(auditLog.resourceId, photo.id)));
    expect(logged.actorId).toBe(adminId);
  });
});
