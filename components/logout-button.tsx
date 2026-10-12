"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/app/lib/auth-client";
import { Button } from "@/components/ui/button";

export function LogoutButton({ redirectTo = "/", className = "" }: { redirectTo?: string; className?: string }) {
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut();
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <Button variant="secondary" className={className} onClick={handleLogout}>
      Cerrar sesión
    </Button>
  );
}
