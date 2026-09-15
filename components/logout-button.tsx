"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/app/lib/auth-client";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await authClient.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <Button variant="secondary" onClick={handleLogout}>
      Cerrar sesión
    </Button>
  );
}
