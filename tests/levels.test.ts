import { describe, expect, it } from "vitest";
import { getLevelProgress } from "@/app/lib/levels";

describe("getLevelProgress", () => {
  it.each([
    [0, { level: 1, xpInLevel: 0, xpToNextLevel: 100, progressPercent: 0 }],
    [99, { level: 1, xpInLevel: 99, xpToNextLevel: 1, progressPercent: 99 }],
    [100, { level: 2, xpInLevel: 0, xpToNextLevel: 100, progressPercent: 0 }],
    [250, { level: 3, xpInLevel: 50, xpToNextLevel: 50, progressPercent: 50 }],
  ])("maps %i XP to level progress", (totalXp, expected) => {
    expect(getLevelProgress(totalXp)).toEqual(expected);
  });

  it("does not expose negative progress", () => {
    expect(getLevelProgress(-10)).toEqual({
      level: 1,
      xpInLevel: 0,
      xpToNextLevel: 100,
      progressPercent: 0,
    });
  });
});
