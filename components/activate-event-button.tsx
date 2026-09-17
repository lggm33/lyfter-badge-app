"use client";

import { useRef } from "react";
import { activateEvent } from "@/app/(protected)/company/[companyId]/actions";

export function ActivateEventButton({ companyId, eventId }: { companyId: string; eventId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button className="rounded-full bg-[#71ceff] px-4 py-2 text-sm font-bold text-slate-800" onClick={() => dialog.current?.showModal()} type="button">
        Activar evento
      </button>
      <dialog className="max-w-md rounded-3xl p-0 shadow-xl backdrop:bg-slate-900/50" ref={dialog}>
        <div className="grid gap-4 p-6">
          <h2 className="text-xl font-black text-slate-800">¿Activar este evento?</h2>
          <p className="text-slate-600">Solo podés activarlo durante las 24 horas previas al inicio. Después de activarlo no se podrán hacer cambios en la configuración del evento.</p>
          <div className="flex justify-end gap-3">
            <button className="rounded-full border border-slate-200 px-4 py-2 font-bold" onClick={() => dialog.current?.close()} type="button">Cancelar</button>
            <form action={activateEvent}>
              <input type="hidden" name="companyId" value={companyId} />
              <input type="hidden" name="eventId" value={eventId} />
              <button className="rounded-full bg-slate-800 px-4 py-2 font-bold text-white" type="submit">Confirmar activación</button>
            </form>
          </div>
        </div>
      </dialog>
    </>
  );
}
