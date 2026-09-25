import { checkInMessage, type CheckInResult } from "@/app/lib/check-in-message";

export type RedeemSuccess = {
  ok: true;
  outcome: "granted" | "already_redeemed";
  badgeName: string;
  eventName: string;
  xp: number;
};

export type RedeemFailure = {
  ok: false;
  reason: "invalid" | "expired" | "not_checked_in" | "event_closed" | "unauthenticated";
};

export type RedeemResult = RedeemSuccess | RedeemFailure;

export type ScanResult = ({ flow: "checkin" } & CheckInResult) | ({ flow: "redeem" } & RedeemResult);

export function scanMessage(result: ScanResult) {
  if (result.flow === "checkin") {
    return checkInMessage(result);
  }
  if (result.ok && result.outcome === "granted") {
    return `Listo. Sumaste ${result.xp} XP por ${result.badgeName}.`;
  }
  if (result.ok) {
    return `Ya tenías ${result.badgeName}.`;
  }
  if (result.reason === "not_checked_in") {
    return "Primero tenés que hacer check-in en el evento.";
  }
  if (result.reason === "expired") {
    return "El QR venció. Escaneá el de la pantalla de nuevo.";
  }
  if (result.reason === "event_closed") {
    return "Este evento no está abierto para canjear badges.";
  }
  if (result.reason === "unauthenticated") {
    return "Entrá a tu cuenta para canjear el badge.";
  }
  return "Ese QR no es válido.";
}
