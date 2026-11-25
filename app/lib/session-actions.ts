"use server";

import { ensureActiveSession } from "@/app/lib/user-status";

export async function ensureActiveSessionAction() {
  return ensureActiveSession();
}
