"use client";

import { useActionState } from "react";
import { claimQrDisplay } from "@/app/display/actions";

export function ClaimDisplayForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(claimQrDisplay, null);

  return (
    <form action={formAction} className="grid gap-3">
      <input type="hidden" name="token" value={token} />
      {state?.error && (
        <p className="text-sm font-bold text-rose-400" role="alert">
          {state.error}
        </p>
      )}
      <button
        className="rounded-full bg-white px-5 py-3 font-bold text-slate-900 disabled:opacity-50"
        disabled={pending}
        type="submit"
      >
        {pending ? "Emparejando…" : "Emparejar esta pantalla"}
      </button>
    </form>
  );
}
