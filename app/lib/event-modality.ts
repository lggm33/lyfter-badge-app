export const EVENT_MODALITIES = ["IN_PERSON", "VIRTUAL", "HYBRID"] as const;

export type EventModality = (typeof EVENT_MODALITIES)[number];

const MODALITY_LABELS: Record<EventModality, string> = {
  IN_PERSON: "Presencial",
  VIRTUAL: "Virtual",
  HYBRID: "Híbrido",
};

export function isEventModality(value: string): value is EventModality {
  return EVENT_MODALITIES.some((modality) => modality === value);
}

export function modalityLabel(value: string | null) {
  if (value !== null && isEventModality(value)) return MODALITY_LABELS[value];
  return null;
}

export function eventPlaceSummary(place: { country: string | null; modality: string | null }) {
  const parts = [modalityLabel(place.modality), place.country].filter((part) => part);
  return parts.join(" · ");
}
