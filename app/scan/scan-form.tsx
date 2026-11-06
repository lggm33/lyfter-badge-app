"use client";

import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";

export function ScanForm({ onToken, busy }: { onToken: (token: string) => void; busy: boolean }) {
  return (
    <form
      className="mt-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5"
      onSubmit={(event) => {
        event.preventDefault();
        const token = String(new FormData(event.currentTarget).get("token") ?? "").trim();
        if (token) onToken(token);
      }}
    >
      <FormField id="token" name="token" label="Código o link" placeholder="Pegá el token o la URL" />
      <Button type="submit" isLoading={busy}>
        Usar este código
      </Button>
    </form>
  );
}
