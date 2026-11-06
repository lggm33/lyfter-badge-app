"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/app/lib/auth";
import { extractScanToken } from "@/app/lib/check-in";
import { scanToken } from "@/app/lib/scan";
import { destinationAfterScan, type ScanResult } from "@/app/lib/scan-message";

/** Called by the in-page camera and the paste form, so both can retry the same request. */
export async function submitScan(rawToken: string): Promise<ScanResult> {
  const token = extractScanToken(rawToken);
  const userId = await currentUserId();

  if (!userId) {
    redirect(`/scan?t=${encodeURIComponent(token)}`);
  }

  const result = await scanToken(token, userId);
  const destination = destinationAfterScan(result);
  if (destination) redirect(destination);
  return result;
}

export async function currentUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}
