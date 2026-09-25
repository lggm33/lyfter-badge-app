export type CheckInSuccess = {
  ok: true;
  outcome: "checked_in" | "already_checked_in";
  eventId: string;
  eventName: string;
};

export type CheckInFailure = {
  ok: false;
  reason: "invalid" | "expired" | "not_checkin" | "event_closed" | "unauthenticated";
};

export type CheckInResult = CheckInSuccess | CheckInFailure;

export function checkInMessage(result: CheckInResult) {
  if (result.ok && result.outcome === "checked_in") {
    return `Listo. Ya estás en ${result.eventName}.`;
  }
  if (result.ok) {
    return `Ya estabas registrado en ${result.eventName}.`;
  }
  if (result.reason === "expired") {
    return "El QR venció. Escaneá el de la pantalla de nuevo.";
  }
  if (result.reason === "not_checkin") {
    return "Ese QR es de un badge. El canje todavía no está disponible.";
  }
  if (result.reason === "event_closed") {
    return "Este evento no está abierto para check-in.";
  }
  if (result.reason === "unauthenticated") {
    return "Entrá a tu cuenta para registrar la asistencia.";
  }
  return "Ese QR no es válido.";
}
