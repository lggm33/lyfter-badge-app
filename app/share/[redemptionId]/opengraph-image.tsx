import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { badgeIconFile } from "@/app/lib/badge-icons";
import { loadShareCard, shareCardDetail } from "@/app/lib/share-badge";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ShareBadgeImage({ params }: { params: Promise<{ redemptionId: string }> }) {
  const { redemptionId } = await params;
  const card = await loadShareCard(redemptionId);
  if (!card) notFound();
  const icon = iconDataUri(card.icon);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 24,
          padding: 72,
          background: "#f8fafc",
          color: "#1e293b",
          fontSize: 56,
        }}
      >
        <div style={{ display: "flex", fontSize: 28, letterSpacing: 6, color: "#71ceff" }}>LYFTER</div>
        {icon && <img alt="" height={120} src={icon} width={120} />}
        <div style={{ display: "flex", fontSize: 64, fontWeight: 800 }}>{card.name}</div>
        <div style={{ display: "flex", fontSize: 36, color: "#475569" }}>{shareCardDetail(card)}</div>
        <div style={{ display: "flex", fontSize: 28, color: "#64748b" }}>{card.eventName}</div>
      </div>
    ),
    size,
  );
}

export const alt = "Badge de Lyfter";

function iconDataUri(emoji: string | null) {
  const file = badgeIconFile(emoji);
  if (!file) return null;
  const svg = readFileSync(join(process.cwd(), "public/badge-icons", file));
  return `data:image/svg+xml;base64,${svg.toString("base64")}`;
}
