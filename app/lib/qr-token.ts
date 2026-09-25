import { createHmac, timingSafeEqual } from "node:crypto";

export const QR_WINDOW_SECONDS = 30;
// ~3 minutes back covers slow scans and flaky signal; one window ahead covers clock skew between instances.
export const QR_GRACE_WINDOWS = 5;
const QR_FUTURE_WINDOWS = 1;

const QR_KINDS = ["badge", "checkin"] as const;
export type QrKind = (typeof QR_KINDS)[number];
export type QrSubject = { kind: QrKind; subjectId: string };
export type QrVerification = ({ ok: true } & QrSubject) | { ok: false; reason: "invalid" | "expired" };

/**
 * Stateless rotating token: `kind.subjectId.window.hmac`. Nothing is persisted;
 * a token is valid while its window is inside the grace period.
 * Double redemption is prevented by the (user_id, badge_id) unique, not by the token.
 */
export function signQrToken(subject: QrSubject, now = new Date(), secret = qrSecret()) {
  const payload = `${subject.kind}.${subject.subjectId}.${windowAt(now)}`;
  return `${payload}.${sign(payload, secret)}`;
}

export function verifyQrToken(token: string, now = new Date(), secret = qrSecret()): QrVerification {
  const parts = token.split(".");
  if (parts.length !== 4) return { ok: false, reason: "invalid" };

  const [kind, subjectId, window, signature] = parts;
  if (!isQrKind(kind) || !subjectId || !/^\d+$/.test(window)) return { ok: false, reason: "invalid" };

  // Compare the encoded strings, not decoded bytes, so equivalent base64 spellings don't pass.
  const expected = Buffer.from(sign(`${kind}.${subjectId}.${window}`, secret));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    return { ok: false, reason: "invalid" };
  }

  const age = windowAt(now) - Number(window);
  if (age < -QR_FUTURE_WINDOWS) return { ok: false, reason: "invalid" };
  if (age > QR_GRACE_WINDOWS) return { ok: false, reason: "expired" };

  return { ok: true, kind, subjectId };
}

function windowAt(date: Date) {
  return Math.floor(date.getTime() / 1000 / QR_WINDOW_SECONDS);
}

/** Inicio de la próxima ventana: cuándo el token actual dejará de ser el vigente. */
export function qrNextRotation(now = new Date()) {
  return new Date((windowAt(now) + 1) * QR_WINDOW_SECONDS * 1000);
}

function sign(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function isQrKind(value: string): value is QrKind {
  return (QR_KINDS as readonly string[]).includes(value);
}

function qrSecret() {
  const secret = process.env.QR_SECRET;
  if (!secret) throw new Error("QR_SECRET is not set");
  return secret;
}
