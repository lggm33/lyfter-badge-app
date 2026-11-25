import { NextResponse } from "next/server";
import { prepareScanHold } from "@/app/lib/scan-hold";

/** The QR opens this as a GET. A route handler can set the hold cookie; a server component cannot. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("t") ?? "";
  const prepared = await prepareScanHold(token);
  const destination = prepared.ok ? "/scan" : `/scan?error=${prepared.reason}`;
  const response = NextResponse.redirect(new URL(destination, request.url));
  if (prepared.ok) {
    response.cookies.set(prepared.cookie.name, prepared.cookie.value, prepared.cookie.options);
  }
  return response;
}
