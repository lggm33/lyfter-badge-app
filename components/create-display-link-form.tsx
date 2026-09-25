"use client";

import { useActionState } from "react";
import { createQrDisplayLink } from "@/app/(protected)/company/[companyId]/actions";

export function CreateDisplayLinkForm({ companyId, eventId, badgeId }: { companyId: string; eventId: string; badgeId?: string }) {
  const [state, formAction, pending] = useActionState(createQrDisplayLink, null);

  return (
    <div className="grid gap-3">
      <form action={formAction} className="grid gap-3">
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="eventId" value={eventId} />
        {badgeId && <input type="hidden" name="badge" value={badgeId} />}
        <button
          className="justify-self-start rounded-full bg-slate-800 px-4 py-2 font-bold text-white disabled:opacity-50"
          disabled={pending}
          type="submit"
        >
          {pending ? "Creando…" : "Crear link de pantalla"}
        </button>
      </form>
      {state && "error" in state && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700" role="alert">
          {state.error}
        </p>
      )}
      {state && "url" in state && (
        <div className="grid gap-2 rounded-xl bg-slate-50 p-4 text-center">
          <p className="text-sm font-bold text-slate-700">Abrí este link en la tablet del stand. Se muestra una sola vez.</p>
          <div
            className="mx-auto aspect-square w-full max-w-[200px] [&>svg]:h-full [&>svg]:w-full"
            // Safe: SVG generated server-side by the qrcode package from our own URL, not user input.
            dangerouslySetInnerHTML={{ __html: state.qrSvg }}
          />
          <code className="break-all rounded-lg bg-white px-3 py-2 text-xs text-slate-600">{state.url}</code>
        </div>
      )}
    </div>
  );
}
