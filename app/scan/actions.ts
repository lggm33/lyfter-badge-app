"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/app/lib/auth";
import { extractScanToken } from "@/app/lib/check-in";
import { scanToken } from "@/app/lib/scan";
import type { ScanResult } from "@/app/lib/scan-message";
import { loginPathForScan } from "@/app/lib/scan-next";

export async function submitScan(
  _previous: ScanResult | null,
  formData: FormData,
): Promise<ScanResult> {
  const token = extractScanToken(String(formData.get("token") ?? ""));
  const userId = await currentUserId();

  if (!userId) {
    redirect(loginPathForScan(token));
  }

  return scanToken(token, userId);
}

export async function currentUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}
