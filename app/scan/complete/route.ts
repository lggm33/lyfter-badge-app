import { NextResponse } from "next/server";
import { destinationAfterScan } from "@/app/lib/scan-message";
import { SCAN_HOLD_COOKIE, completeScanHold } from "@/app/lib/scan-hold";
import { isUserDisabled } from "@/app/lib/user-status";
import { currentUserId } from "@/app/scan/actions";

/** Finishes a held scan. Cookie writes stay in the route handler, not in the page. */
export async function GET(request: Request) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.redirect(new URL("/scan", request.url));

  if (await isUserDisabled(userId)) {
    return NextResponse.redirect(new URL("/logout-disabled", request.url));
  }

  const completed = await completeScanHold(userId);
  if (!completed) return NextResponse.redirect(new URL("/scan", request.url));

  const destination = destinationAfterScan(completed.result);
  const next = destination ?? holdResultPath(completed.result);
  const response = NextResponse.redirect(new URL(next, request.url));
  if (completed.clearCookie) {
    response.cookies.set(SCAN_HOLD_COOKIE, "", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 0 });
  }
  return response;
}

function holdResultPath(result: { ok: true } | { ok: false; reason: string; flow?: string }) {
  if (result.ok) return "/scan";
  const flow = "flow" in result && result.flow === "redeem" ? "redeem" : "checkin";
  return `/scan?hold=${encodeURIComponent(result.reason)}&flow=${flow}`;
}
