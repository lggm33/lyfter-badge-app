import { describe, expect, it } from "vitest";
import { costaRicaLocalToDate, dateToCostaRicaInput, formatCostaRica } from "@/app/lib/costa-rica-time";
import { eventPhase } from "@/app/lib/event-phase";

describe("Costa Rica event times", () => {
  it("reads a datetime-local value as Costa Rica and writes it back the same way", () => {
    const instant = costaRicaLocalToDate("2026-11-24T10:00");

    expect(instant.toISOString()).toBe("2026-11-24T16:00:00.000Z");
    expect(dateToCostaRicaInput(instant)).toBe("2026-11-24T10:00");
    expect(formatCostaRica(instant)).toContain("10:00");
  });
});

describe("eventPhase", () => {
  const now = Date.parse("2026-11-24T16:00:00.000Z");

  it("keeps a draft as draft after its end", () => {
    expect(eventPhase({ status: "DRAFT", endsAt: new Date(now - 1000) }, now)).toBe("DRAFT");
  });

  it("treats an active event past its end as finished without a stored change", () => {
    expect(eventPhase({ status: "ACTIVE", endsAt: new Date(now - 1000) }, now)).toBe("FINISHED");
    expect(eventPhase({ status: "ACTIVE", endsAt: new Date(now + 1000) }, now)).toBe("ACTIVE");
  });
});
