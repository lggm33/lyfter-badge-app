export const XP_PER_LEVEL = 100;

export function getLevelProgress(totalXp: number) {
  const safeXp = Math.max(0, Math.floor(totalXp));
  const xpInLevel = safeXp % XP_PER_LEVEL;

  return {
    level: Math.floor(safeXp / XP_PER_LEVEL) + 1,
    xpInLevel,
    xpToNextLevel: XP_PER_LEVEL - xpInLevel,
    progressPercent: xpInLevel,
  };
}
