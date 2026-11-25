/** Costa Rica does not observe DST. Event wall times and the traffic chart share this zone. */
export const COSTA_RICA_TIME_ZONE = "America/Costa_Rica";

const COSTA_RICA_OFFSET_MS = 6 * 60 * 60 * 1000;

/** `datetime-local` value, read as Costa Rica wall time. */
export function costaRicaLocalToDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(value);
  if (!match) return new Date(Number.NaN);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  return new Date(Date.UTC(year, month - 1, day, hour, minute) + COSTA_RICA_OFFSET_MS);
}

/** Value for `<input type="datetime-local">`. */
export function dateToCostaRicaInput(date: Date): string {
  return new Date(date.getTime() - COSTA_RICA_OFFSET_MS).toISOString().slice(0, 16);
}

export function formatCostaRica(date: Date): string {
  return new Intl.DateTimeFormat("es-CR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: COSTA_RICA_TIME_ZONE,
  }).format(date);
}
