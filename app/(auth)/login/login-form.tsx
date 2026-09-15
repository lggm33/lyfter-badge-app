"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/app/lib/auth-client";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
    });

    setIsLoading(false);

    if (signInError) {
      setError(signInError.message ?? "No pudimos iniciar sesión.");
      return;
    }

    router.push("/home");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <FormField
        id="email"
        label="Email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
      />
      <FormField
        id="password"
        label="Contraseña"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
      />
      {error && (
        <p className="text-sm font-semibold text-[#e88f95]">{error}</p>
      )}
      <Button type="submit" isLoading={isLoading}>
        Iniciar sesión
      </Button>
    </form>
  );
}
