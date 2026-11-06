import { describe, expect, it } from "vitest";
import { filterEvents } from "@/components/event-list-filter";

const events = [
  { id: "a", name: "Kickoff", status: "FINISHED", startsAt: 1 },
  { id: "b", name: "Centro de Convención", status: "ACTIVE", startsAt: 3 },
  { id: "c", name: "Hackathon", status: "DRAFT", startsAt: 2 },
];

const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe("filterEvents", () => {
  it("orders newest first by default and oldest first on request", () => {
    expect(ids(filterEvents(events, { query: "", status: "", order: "desc" }))).toEqual(["b", "c", "a"]);
    expect(ids(filterEvents(events, { query: "", status: "", order: "asc" }))).toEqual(["a", "c", "b"]);
  });

  it("matches names ignoring case and accents, and filters by status", () => {
    expect(ids(filterEvents(events, { query: " CONVENCION ", status: "", order: "desc" }))).toEqual(["b"]);
    expect(ids(filterEvents(events, { query: "", status: "DRAFT", order: "desc" }))).toEqual(["c"]);
    expect(filterEvents(events, { query: "kick", status: "ACTIVE", order: "desc" })).toEqual([]);
  });
});
