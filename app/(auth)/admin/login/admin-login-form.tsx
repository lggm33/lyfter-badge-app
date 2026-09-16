"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/app/lib/auth-client";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";
import { isSuperAdmin } from "./actions";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    let signedIn = false;
    try {
      const { error: signInError } = await authClient.signIn.email({ email, password });
      if (signInError) {
        setError(signInError.message ?? "Credenciales inválidas.");
        return;
      }
      signedIn = true;

      let allowed: boolean;
      try {
        allowed = await isSuperAdmin();
      } catch {
        await authClient.signOut().catch(() => undefined);
        setError("No pudimos validar los permisos administrativos. Intentá de nuevo.");
        return;
      }

      if (!allowed) {
        const { error: signOutError } = await authClient.signOut();
        setError(
          signOutError
            ? "No pudimos cerrar esta sesión. Cerrá sesión y volvé a intentar."
            : "Esta cuenta no tiene acceso de Super Admin.",
        );
        return;
      }

      router.push("/admin/companies");
      router.refresh();
    } catch {
      if (signedIn) await authClient.signOut().catch(() => undefined);
      setError("No pudimos completar el inicio de sesión. Intentá de nuevo.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <FormField id="email" label="Email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      <FormField id="password" label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
      {error && <p className="text-sm font-semibold text-[#e88f95]">{error}</p>}
      <Button type="submit" isLoading={isLoading}>Ingresar</Button>
    </form>
  );
}
