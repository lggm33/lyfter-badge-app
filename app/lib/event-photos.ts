import { del, put } from "@vercel/blob";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { ActionError } from "@/app/lib/action-error";
import { db } from "@/db";
import { event, eventPhoto } from "@/db/schema";

export const MAX_EVENT_PHOTOS = 8;
export const MAX_EVENT_PHOTO_BYTES = 2_000_000;
export const MAX_PHOTO_CAPTION_LENGTH = 140;

export type PhotoContentType = "image/jpeg" | "image/png" | "image/webp";

export type StoredBlob = { url: string; pathname: string };

export type BlobStore = {
  put: (pathname: string, body: Uint8Array, contentType: PhotoContentType) => Promise<StoredBlob>;
  del: (pathname: string) => Promise<void>;
};

type PhotoTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

let resolveBlobStore: () => BlobStore = vercelBlobStore;

export function imageContentType(bytes: Uint8Array): PhotoContentType | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47])) return "image/png";
  if (readAscii(bytes, 0, 4) === "RIFF" && readAscii(bytes, 8, 4) === "WEBP") return "image/webp";
  return null;
}

export function setBlobStore(next: (() => BlobStore) | null) {
  resolveBlobStore = next ?? vercelBlobStore;
}

export function blobStore() {
  return resolveBlobStore();
}

export async function listPhotosForEvents(eventIds: string[]) {
  if (eventIds.length === 0) return [];

  return db
    .select({
      id: eventPhoto.id,
      eventId: eventPhoto.eventId,
      url: eventPhoto.url,
      alt: eventPhoto.alt,
    })
    .from(eventPhoto)
    .where(inArray(eventPhoto.eventId, eventIds))
    .orderBy(asc(eventPhoto.createdAt));
}

export async function storeEventPhoto(input: {
  companyId: string;
  eventId: string;
  bytes: Uint8Array;
  caption: string | null;
  store: BlobStore;
  audit: (tx: PhotoTransaction, photoId: string, eventName: string) => Promise<void>;
}) {
  const contentType = imageContentType(input.bytes);
  if (!contentType) throw new ActionError("La foto tiene que ser JPEG, PNG o WebP.");
  if (input.bytes.byteLength > MAX_EVENT_PHOTO_BYTES) throw new ActionError("La foto no puede superar los 2 MB.");
  if (input.caption && input.caption.length > MAX_PHOTO_CAPTION_LENGTH) {
    throw new ActionError("La leyenda no puede superar los 140 caracteres.");
  }

  const owned = await findOwnedEvent(input.companyId, input.eventId);
  await assertPhotoRoom(input.eventId);

  const photoId = randomUUID();
  const pathname = `events/${input.eventId}/${photoId}`;
  const stored = await input.store.put(pathname, input.bytes, contentType);

  try {
    await db.transaction(async (tx) => {
      await assertPhotoRoom(input.eventId, tx);
      await tx.insert(eventPhoto).values({
        id: photoId,
        eventId: input.eventId,
        blobPathname: stored.pathname,
        url: stored.url,
        alt: input.caption,
      });
      await input.audit(tx, photoId, owned.name);
    });
  } catch (error) {
    await deleteStoredBlob(input.store, stored.pathname);
    throw error;
  }
}

export async function removeEventPhoto(input: {
  companyId: string;
  eventId: string;
  photoId: string;
  store: BlobStore;
  audit: (tx: PhotoTransaction, photoId: string, eventName: string) => Promise<void>;
}) {
  const owned = await findOwnedEvent(input.companyId, input.eventId);
  const [photo] = await db
    .select({ pathname: eventPhoto.blobPathname })
    .from(eventPhoto)
    .where(and(eq(eventPhoto.id, input.photoId), eq(eventPhoto.eventId, input.eventId)));
  if (!photo) throw new ActionError("La foto no existe.");

  await db.transaction(async (tx) => {
    await tx.delete(eventPhoto).where(eq(eventPhoto.id, input.photoId));
    await input.audit(tx, input.photoId, owned.name);
  });
  await deleteStoredBlob(input.store, photo.pathname);
}

function vercelBlobStore(): BlobStore {
  const token = process.env.BLOB_READ_WRITE_TOKEN;
  if (!token) {
    throw new ActionError("Falta configurar el almacenamiento de fotos.");
  }

  return {
    async put(pathname, body, contentType) {
      const stored = await put(pathname, Buffer.from(body), { access: "public", contentType, token });
      return { url: stored.url, pathname: stored.pathname };
    },
    async del(pathname) {
      await del(pathname, { token });
    },
  };
}

async function findOwnedEvent(companyId: string, eventId: string) {
  const [owned] = await db
    .select({ name: event.name })
    .from(event)
    .where(and(eq(event.id, eventId), eq(event.companyId, companyId)));
  if (!owned) throw new ActionError("El evento no existe.");
  return owned;
}

async function assertPhotoRoom(eventId: string, tx: PhotoTransaction | typeof db = db) {
  const [row] = await tx.select({ total: count() }).from(eventPhoto).where(eq(eventPhoto.eventId, eventId));
  if (Number(row?.total ?? 0) >= MAX_EVENT_PHOTOS) throw new ActionError("Este evento ya tiene 8 fotos.");
}

async function deleteStoredBlob(store: BlobStore, pathname: string) {
  try {
    await store.del(pathname);
  } catch {
    // The database row is already gone. A leftover blob is cheaper than a broken image.
  }
}

function startsWith(bytes: Uint8Array, signature: number[]) {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function readAscii(bytes: Uint8Array, start: number, length: number) {
  if (bytes.length < start + length) return "";
  return String.fromCharCode(...bytes.slice(start, start + length));
}
