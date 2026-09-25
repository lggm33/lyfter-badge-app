import { checkIn, extractScanToken } from "@/app/lib/check-in";
import { redeemBadge } from "@/app/lib/redeem";
import type { ScanResult } from "@/app/lib/scan-message";
import { verifyQrToken } from "@/app/lib/qr-token";

/** Routes a scanned token to check-in or badge redemption. */
export async function scanToken(token: string, userId: string | null): Promise<ScanResult> {
  const verified = verifyQrToken(extractScanToken(token));
  if (!verified.ok) {
    return { flow: "checkin", ok: false, reason: verified.reason };
  }
  if (verified.kind === "badge") {
    return { flow: "redeem", ...(await redeemBadge(token, userId)) };
  }
  return { flow: "checkin", ...(await checkIn(token, userId)) };
}
