import { notFound } from "next/navigation";
import { ActivateEventButton } from "@/components/activate-event-button";
import { createEvent, deleteEvent, getMyCompany, listMyCompanyEvents, updateEvent } from "./actions";

export default async function CompanyHomePage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await getMyCompany(companyId);
  const events = await listMyCompanyEvents(companyId);

  if (!company) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-start justify-center gap-6 px-6">
      <p className="inline-flex rounded-full bg-[#add195]/40 px-4 py-2 text-sm font-bold text-slate-700">
        Administrás esta empresa
      </p>
      <h1 className="text-4xl font-black tracking-tight text-slate-800">
        {company.name}
      </h1>
      <p className="text-lg text-slate-600">
        Creá y administrá los eventos de tu empresa.
      </p>
      <form action={createEvent} className="grid w-full gap-3 rounded-3xl bg-white p-6 shadow-sm">
        <input type="hidden" name="companyId" value={companyId} />
        <h2 className="text-xl font-black text-slate-800">Nuevo evento</h2>
        <input className="rounded-xl border border-slate-200 px-4 py-3" name="name" placeholder="Nombre" required maxLength={160} />
        <input className="rounded-xl border border-slate-200 px-4 py-3" name="slug" placeholder="Sobrenombre (evento-2026)" required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={100} />
        <textarea className="rounded-xl border border-slate-200 px-4 py-3" name="description" placeholder="Descripción" />
        <input className="rounded-xl border border-slate-200 px-4 py-3" name="location" placeholder="Ubicación" />
        <label className="grid gap-1 text-sm font-bold text-slate-700">Inicio<input className="rounded-xl border border-slate-200 px-4 py-3 font-normal" type="datetime-local" name="startsAt" required /></label>
        <label className="grid gap-1 text-sm font-bold text-slate-700">Cierre<input className="rounded-xl border border-slate-200 px-4 py-3 font-normal" type="datetime-local" name="endsAt" required /></label>
        <button className="rounded-full bg-slate-800 px-5 py-3 font-bold text-white" type="submit">Crear evento</button>
      </form>
      <section className="w-full" id="eventos">
        <h2 className="mt-8 text-xl font-black text-slate-800">Eventos</h2>
        {events.length === 0 ? <p className="mt-3 text-slate-600">Todavía no hay eventos.</p> : <ul className="mt-3 grid gap-3">{events.map((item) => <li className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm" key={item.id}><div className="flex items-center justify-between gap-3"><div><strong>{item.name}</strong><p className="text-sm text-slate-500">{item.status} · {item.startsAt.toLocaleString()}</p></div>{item.status === "DRAFT" && <ActivateEventButton companyId={companyId} eventId={item.id} />}</div>{item.status === "DRAFT" && <details><summary className="cursor-pointer text-sm font-bold text-slate-700">Editar evento</summary><form action={updateEvent} className="mt-3 grid gap-3"><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="eventId" value={item.id} /><input className="rounded-xl border border-slate-200 px-4 py-3" name="name" defaultValue={item.name} required maxLength={160} /><input className="rounded-xl border border-slate-200 px-4 py-3" name="slug" defaultValue={item.slug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={100} /><textarea className="rounded-xl border border-slate-200 px-4 py-3" name="description" defaultValue={item.description ?? ""} /><input className="rounded-xl border border-slate-200 px-4 py-3" name="location" defaultValue={item.location ?? ""} /><input className="rounded-xl border border-slate-200 px-4 py-3" type="datetime-local" name="startsAt" defaultValue={item.startsAt.toISOString().slice(0, 16)} required /><input className="rounded-xl border border-slate-200 px-4 py-3" type="datetime-local" name="endsAt" defaultValue={item.endsAt.toISOString().slice(0, 16)} required /><button className="justify-self-start rounded-full bg-slate-800 px-4 py-2 font-bold text-white" type="submit">Guardar cambios</button></form></details>}{item.status === "DRAFT" && <form action={deleteEvent}><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="eventId" value={item.id} /><button className="justify-self-start text-sm font-bold text-red-600" type="submit">Eliminar</button></form>}</li>)}</ul>}
      </section>
    </main>
  );
}
