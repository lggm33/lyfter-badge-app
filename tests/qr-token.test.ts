import { describe, expect, it } from "vitest";
import {
  QR_GRACE_WINDOWS,
  QR_WINDOW_SECONDS,
  qrNextRotation,
  signQrToken,
  verifyQrToken,
} from "@/app/lib/qr-token";

const SECRET = "test-secret";
const NOW = new Date("2026-09-24T12:00:00Z");
const BADGE = { kind: "badge", subjectId: "badge-123" } as const;

const later = (windows: number) => new Date(NOW.getTime() + windows * QR_WINDOW_SECONDS * 1000);

describe("signQrToken / verifyQrToken", () => {
  it("verifica un token de badge y uno de check-in dentro de su ventana", () => {
    expect(verifyQrToken(signQrToken(BADGE, NOW, SECRET), NOW, SECRET)).toEqual({ ok: true, ...BADGE });

    const checkin = { kind: "checkin", subjectId: "event-456" } as const;
    expect(verifyQrToken(signQrToken(checkin, NOW, SECRET), NOW, SECRET)).toEqual({ ok: true, ...checkin });
  });

  it("rota en cada ventana y se mantiene estable dentro de ella", () => {
    const token = signQrToken(BADGE, NOW, SECRET);
    expect(signQrToken(BADGE, new Date(NOW.getTime() + 1000), SECRET)).toBe(token);
    expect(signQrToken(BADGE, later(1), SECRET)).not.toBe(token);
  });

  it("acepta el token hasta la tolerancia y lo marca vencido después", () => {
    const token = signQrToken(BADGE, NOW, SECRET);
    expect(verifyQrToken(token, later(QR_GRACE_WINDOWS), SECRET).ok).toBe(true);
    expect(verifyQrToken(token, later(QR_GRACE_WINDOWS + 1), SECRET)).toEqual({ ok: false, reason: "expired" });
  });

  it("tolera una ventana hacia adelante por desfase de reloj, no más", () => {
    expect(verifyQrToken(signQrToken(BADGE, later(1), SECRET), NOW, SECRET).ok).toBe(true);
    expect(verifyQrToken(signQrToken(BADGE, later(2), SECRET), NOW, SECRET)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rechaza firmas alteradas, otro secreto o un subject cambiado", () => {
    const token = signQrToken(BADGE, NOW, SECRET);
    const [kind, , window, signature] = token.split(".");

    const flipped = `${signature[0] === "A" ? "B" : "A"}${signature.slice(1)}`;
    expect(verifyQrToken(`${kind}.badge-123.${window}.${flipped}`, NOW, SECRET)).toEqual({ ok: false, reason: "invalid" });
    expect(verifyQrToken(token, NOW, "other-secret")).toEqual({ ok: false, reason: "invalid" });
    expect(verifyQrToken(`${kind}.badge-999.${window}.${signature}`, NOW, SECRET)).toEqual({ ok: false, reason: "invalid" });
    expect(verifyQrToken(`checkin.badge-123.${window}.${signature}`, NOW, SECRET)).toEqual({ ok: false, reason: "invalid" });
  });

  it("rechaza formatos rotos y kinds desconocidos", () => {
    const window = Math.floor(NOW.getTime() / 1000 / QR_WINDOW_SECONDS);
    for (const token of ["", "a.b", "badge..1.sig", `badge.x.1e3.sig`, `stand.x.${window}.sig`, `badge.x.${window}.sig.extra`]) {
      expect(verifyQrToken(token, NOW, SECRET)).toEqual({ ok: false, reason: "invalid" });
    }
  });

  it("calcula el inicio de la próxima ventana de rotación", () => {
    expect(qrNextRotation(NOW)).toEqual(new Date("2026-09-24T12:00:30Z"));
    expect(qrNextRotation(new Date("2026-09-24T12:00:29.999Z"))).toEqual(new Date("2026-09-24T12:00:30Z"));
  });
});
