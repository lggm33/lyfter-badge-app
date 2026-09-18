import { notFound } from "next/navigation";
import { ActivateEventButton } from "@/components/activate-event-button";
import { CreateEventForm } from "@/components/create-event-form";
import { createBadge, deleteBadge, deleteEvent, getMyCompany, listEventBadges, listMyCompanyEvents, updateBadge, updateEvent } from "./actions";

const badgeIcons = ["🏆", "🎤", "🧠", "💡", "🚀", "🤝", "⭐", "🎯", "🔥", "💎"];
const badgePointOptions = [50, 100, 250, 500, 1000];

function BadgeFields({ current }: { current?: { name: string; description: string | null; icon: string | null; type: string; rarity: string; xp: number; required: boolean } }) {
  return <>
    <input className="rounded-xl border border-slate-200 px-3 py-2" name="name" defaultValue={current?.name} placeholder="Nombre del badge" required maxLength={120} />
    <textarea className="rounded-xl border border-slate-200 px-3 py-2" name="description" defaultValue={current?.description ?? ""} placeholder="Descripción" />
    <select className="rounded-xl border border-slate-200 px-3 py-2" name="icon" defaultValue={current?.icon ?? ""} aria-label="Icono"><option value="">{current ? "Sin icono" : "Elegí un icono"}</option>{badgeIcons.map((icon) => <option key={icon} value={icon}>{icon}</option>)}</select>
    <select className="rounded-xl border border-slate-200 px-3 py-2" name="type" defaultValue={current?.type ?? "CONTENT"}><option value="CONTENT">Contenido</option><option value="TALK">Charla</option><option value="STAND">Stand</option></select>
    <select className="rounded-xl border border-slate-200 px-3 py-2" name="rarity" defaultValue={current?.rarity ?? "COMMON"}><option value="COMMON">Común</option><option value="RARE">Raro</option><option value="EPIC">Épico</option><option value="LEGENDARY">Legendario</option></select>
    <select className="rounded-xl border border-slate-200 px-3 py-2" name="xp" defaultValue={current?.xp ?? 100} aria-label="Puntos">{badgePointOptions.map((points) => <option key={points} value={points}>{points} puntos</option>)}</select>
    <label className="text-sm"><input className="mr-2" name="required" type="checkbox" defaultChecked={current?.required ?? true} />Requerido</label>
  </>;
}

export default async function CompanyHomePage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const company = await getMyCompany(companyId);
  const events = await listMyCompanyEvents(companyId);
  const eventsWithBadges = await Promise.all(events.map(async (item) => ({ item, badges: await listEventBadges(companyId, item.id) })));

  if (!company) notFound();

  return <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-start justify-center gap-6 px-6">
    <p className="inline-flex rounded-full bg-[#add195]/40 px-4 py-2 text-sm font-bold text-slate-700">Administrás esta empresa</p>
    <h1 className="text-4xl font-black tracking-tight text-slate-800">{company.name}</h1>
    <p className="text-lg text-slate-600">Creá y administrá los eventos de tu empresa.</p>
    <CreateEventForm companyId={companyId} />
    <section className="w-full" id="eventos"><h2 className="mt-8 text-xl font-black text-slate-800">Eventos</h2>{events.length === 0 ? <p className="mt-3 text-slate-600">Todavía no hay eventos.</p> : <ul className="mt-3 grid gap-3">{eventsWithBadges.map(({ item, badges }) => <li className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm" key={item.id}>
      <div className="flex items-center justify-between gap-3"><div><strong>{item.name}</strong><p className="text-sm text-slate-500">{item.status} · {item.startsAt.toLocaleString()}</p></div>{item.canActivate && <ActivateEventButton companyId={companyId} eventId={item.id} />}</div>
      {item.status === "DRAFT" && <details><summary className="cursor-pointer text-sm font-bold text-slate-700">Editar evento</summary><form action={updateEvent} className="mt-3 grid gap-3"><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="eventId" value={item.id} /><input className="rounded-xl border border-slate-200 px-4 py-3" name="name" defaultValue={item.name} required maxLength={160} /><input className="rounded-xl border border-slate-200 px-4 py-3" name="slug" defaultValue={item.slug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={100} /><textarea className="rounded-xl border border-slate-200 px-4 py-3" name="description" defaultValue={item.description ?? ""} /><input className="rounded-xl border border-slate-200 px-4 py-3" name="location" defaultValue={item.location ?? ""} /><input className="rounded-xl border border-slate-200 px-4 py-3" type="datetime-local" name="startsAt" defaultValue={item.startsAt.toISOString().slice(0, 16)} required /><input className="rounded-xl border border-slate-200 px-4 py-3" type="datetime-local" name="endsAt" defaultValue={item.endsAt.toISOString().slice(0, 16)} required /><button className="justify-self-start rounded-full bg-slate-800 px-4 py-2 font-bold text-white" type="submit">Guardar cambios</button></form></details>}
      {item.status === "DRAFT" && <form action={deleteEvent}><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="eventId" value={item.id} /><button className="justify-self-start text-sm font-bold text-red-600" type="submit">Eliminar</button></form>}
      <section className="grid gap-3 border-t border-slate-100 pt-4"><h3 className="font-black text-slate-800">Badges</h3>{badges.length === 0 ? <p className="text-sm text-slate-500">Todavía no hay badges.</p> : <ul className="grid gap-2">{badges.map((badge) => <li className="rounded-xl border border-slate-100 p-3" key={badge.id}><div className="flex items-center justify-between gap-3"><span><strong>{badge.icon ? `${badge.icon} ` : ""}{badge.name}</strong><span className="ml-2 text-sm text-slate-500">{badge.type} · {badge.rarity} · {badge.xp} XP{badge.required ? " · requerido" : " · opcional"}</span></span>{item.status === "DRAFT" && <form action={deleteBadge}><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="eventId" value={item.id} /><input type="hidden" name="badgeId" value={badge.id} /><button className="text-sm font-bold text-red-600" type="submit">Eliminar</button></form>}</div>{item.status === "DRAFT" && <details><summary className="mt-2 cursor-pointer text-sm font-bold text-slate-700">Editar badge</summary><form action={updateBadge} className="mt-3 grid gap-2"><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="eventId" value={item.id} /><input type="hidden" name="badgeId" value={badge.id} /><BadgeFields current={badge} /><button className="justify-self-start rounded-full bg-slate-800 px-4 py-2 font-bold text-white" type="submit">Guardar badge</button></form></details>}</li>)}</ul>}{item.status === "DRAFT" && <form action={createBadge} className="grid gap-2 rounded-xl bg-slate-50 p-3"><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="eventId" value={item.id} /><BadgeFields /><button className="justify-self-start rounded-full bg-slate-800 px-4 py-2 font-bold text-white" type="submit">Crear badge</button></form>}</section>
    </li>)}</ul>}</section>
  </main>;
}
