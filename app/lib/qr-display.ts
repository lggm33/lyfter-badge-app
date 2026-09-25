import { createHash, randomBytes } from "node:crypto";
import QRCode from "qrcode";
import { qrNextRotation, signQrToken } from "@/app/lib/qr-token";

export type QrDisplay =
  | { status: "active"; kind: "checkin" | "badge"; title: string; eventName: string; url: string; nextRotationAt: Date }
  | { status: "inactive"; eventName: string; eventStatus: string };

export const DISPLAY_COOKIE = "qr_display";

/** Token crudo para el link o el dispositivo; solo su hash se persiste. */
export function createDisplayToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashDisplayToken(token) };
}

export function hashDisplayToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Arma el QR rotativo vigente para un evento (check-in) o un badge puntual. Sin estado: nada se persiste. */
export function buildQrDisplay(
  ev: { id: string; name: string; status: string; endsAt: Date },
  b: { id: string; name: string; icon: string | null } | undefined,
  now: Date,
): QrDisplay {
  if (ev.status !== "ACTIVE" || ev.endsAt <= now) {
    return { status: "inactive", eventName: ev.name, eventStatus: ev.status };
  }
  const betterAuthUrl = process.env.BETTER_AUTH_URL;
  if (!betterAuthUrl) throw new Error("BETTER_AUTH_URL is not set");
  const kind = b ? "badge" : "checkin";
  const token = signQrToken({ kind, subjectId: b ? b.id : ev.id }, now);
  return {
    status: "active",
    kind,
    title: b ? `${b.icon ? `${b.icon} ` : ""}${b.name}` : "Check-in",
    eventName: ev.name,
    url: `${betterAuthUrl}/scan?t=${encodeURIComponent(token)}`,
    nextRotationAt: qrNextRotation(now),
  };
}

export function renderQrSvg(text: string): Promise<string> {
  return QRCode.toString(text, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
}
