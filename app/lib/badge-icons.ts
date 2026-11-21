export const BADGE_ICONS = [
  { emoji: "🏆", file: "trophy.svg" },
  { emoji: "🎤", file: "microphone.svg" },
  { emoji: "🧠", file: "brain.svg" },
  { emoji: "💡", file: "bulb.svg" },
  { emoji: "🚀", file: "rocket.svg" },
  { emoji: "🤝", file: "handshake.svg" },
  { emoji: "⭐", file: "star.svg" },
  { emoji: "🎯", file: "target.svg" },
  { emoji: "🔥", file: "flame.svg" },
  { emoji: "💎", file: "gem.svg" },
] as const;

export function badgeIconFile(emoji: string | null) {
  if (!emoji) return null;
  const match = BADGE_ICONS.find((icon) => icon.emoji === emoji);
  return match ? match.file : null;
}
