import { describe, expect, it } from "vitest";
import { destinationAfterScan } from "@/app/lib/scan-message";

describe("destinationAfterScan", () => {
  it("carries the awarded level to the fresh badge page", () => {
    expect(
      destinationAfterScan({
        flow: "redeem",
        ok: true,
        outcome: "granted",
        badgeId: "badge-1",
        badgeName: "Stand",
        eventName: "Demo Day",
        xp: 100,
        levelUpTo: 2,
        totalXpAfter: 100,
      }),
    ).toBe("/badge/badge-1?fresh=1&levelUpTo=2&totalXp=100");
  });

  it("does not claim a level-up when the badge does not cross a threshold", () => {
    expect(
      destinationAfterScan({
        flow: "redeem",
        ok: true,
        outcome: "granted",
        badgeId: "badge-1",
        badgeName: "Stand",
        eventName: "Demo Day",
        xp: 25,
        levelUpTo: null,
        totalXpAfter: 25,
      }),
    ).toBe("/badge/badge-1?fresh=1");
  });
});
