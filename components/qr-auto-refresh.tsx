"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function QrAutoRefresh({ nextRotationAt }: { nextRotationAt: string }) {
  const router = useRouter();

  useEffect(() => {
    const delay = Math.max(0, new Date(nextRotationAt).getTime() - Date.now()) + 500;
    const timeout = setTimeout(() => router.refresh(), delay);
    return () => clearTimeout(timeout);
  }, [nextRotationAt, router]);

  return null;
}
