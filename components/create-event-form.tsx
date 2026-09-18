"use client";

import { useActionState } from "react";
import { createEvent } from "@/app/(protected)/company/[companyId]/actions";
import { FutureDateTimeInput } from "@/components/future-date-time-input";

export function CreateEventForm({ companyId }: { companyId: string }) {
  const [state, formAction, pending] = useActionState(createEvent, null);

  return <form action={formAction} className="grid w-full gap-3 rounded-3xl bg-white p-6 shadow-sm"><input type="hidden" name="companyId" value={companyId} /><h2 className="text-xl font-black text-slate-800">Nuevo evento</h2><input className="rounded-xl border border-slate-200 px-4 py-3" name="name" placeholder="Nombre" required maxLength={160} /><input className="rounded-xl border border-slate-200 px-4 py-3" name="slug" placeholder="Sobrenombre (evento-2026)" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={100} /><textarea className="rounded-xl border border-slate-200 px-4 py-3" name="description" placeholder="Descripción" /><input className="rounded-xl border border-slate-200 px-4 py-3" name="location" placeholder="Ubicación" /><label className="grid gap-1 text-sm font-bold text-slate-700">Inicio<FutureDateTimeInput /></label><label className="grid gap-1 text-sm font-bold text-slate-700">Cierre<input className="rounded-xl border border-slate-200 px-4 py-3 font-normal" type="datetime-local" name="endsAt" required /></label>{state?.error && <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700" role="alert">{state.error}</p>}<button className="rounded-full bg-slate-800 px-5 py-3 font-bold text-white disabled:opacity-50" disabled={pending} type="submit">{pending ? "Creando..." : "Crear evento"}</button></form>;
}
