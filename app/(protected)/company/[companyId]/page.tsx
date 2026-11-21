import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ActivateEventButton } from "@/components/activate-event-button";
import { CreateEventForm } from "@/components/create-event-form";
import { EventPhotoGallery } from "@/components/event-photo-gallery";
import { EventListFilter } from "@/components/event-list-filter";
import { EventPlaceFields } from "@/components/event-place-fields";
import { EventStatusBadge } from "@/components/event-status-badge";
import { BADGE_ICONS } from "@/app/lib/badge-icons";
import { eventPlaceSummary } from "@/app/lib/event-modality";
import { listPhotosForEvents } from "@/app/lib/event-photos";
import { createBadge, deleteBadge, deleteEvent, deleteRafflePrize, drawRaffle, getMyCompany, listEventBadges, listEventRaffle, listMyCompanyEvents, saveRafflePrize, savePrize, updateBadge, updateEvent } from "./actions";

const badgeIcons = BADGE_ICONS.map((icon) => icon.emoji);
const badgePointOptions = [50, 100, 250, 500, 1000];

function BadgeFields({ current, optionalOnly = false }: { current?: { name: string; description: string | null; icon: string | null; type: string; rarity: string; xp: number; required: boolean }; optionalOnly?: boolean }) {
  return <>
    <input className="rounded-xl border border-slate-200 px-3 py-2" name="name" defaultValue={current?.name} placeholder="Nombre del badge" required maxLength={120} />
    <textarea className="rounded-xl border border-slate-200 px-3 py-2" name="description" defaultValue={current?.description ?? ""} placeholder="Descripción" />
    <select className="rounded-xl border border-slate-200 px-3 py-2" name="icon" defaultValue={current?.icon ?? ""} aria-label="Icono"><option value="">{current ? "Sin icono" : "Elegí un icono"}</option>{badgeIcons.map((icon) => <option key={icon} value={icon}>{icon}</option>)}</select>
    <select className="rounded-xl border border-slate-200 px-3 py-2" name="type" defaultValue={current?.type ?? "CONTENT"}><option value="CONTENT">Contenido</option><option value="TALK">Charla</option><option value="STAND">Stand</option></select>
    <select className="rounded-xl border border-slate-200 px-3 py-2" name="rarity" defaultValue={current?.rarity ?? "COMMON"}><option value="COMMON">Común</option><option value="RARE">Raro</option><option value="EPIC">Épico</option><option value="LEGENDARY">Legendario</option></select>
    <select className="rounded-xl border border-slate-200 px-3 py-2" name="xp" defaultValue={current?.xp ?? 100} aria-label="Puntos">{badgePointOptions.map((points) => <option key={points} value={points}>{points} puntos</option>)}</select>
    {optionalOnly ? <p className="text-sm text-slate-500">Opcional: con el evento activo solo se suman badges opcionales.</p> : <label className="text-sm"><input className="mr-2" name="required" type="checkbox" defaultChecked={current?.required ?? true} />Requerido</label>}
  </>;
}

function PrizeSection({ companyId, item, hasRequiredBadge }: { companyId: string; item: { id: string; prizeTitle: string | null; prizeDescription: string | null; prizeEditable: boolean; completedCount: number; claimedCount: number }; hasRequiredBadge: boolean }) {
  return <section className="grid gap-3 border-t border-slate-100 pt-4"><h3 className="font-black text-slate-800">Premio</h3>
    <p className="text-sm text-slate-500">{item.completedCount} completaron · {item.claimedCount} reclamaron</p>
    {item.prizeTitle ? <p><strong>{item.prizeTitle}</strong>{item.prizeDescription && <span className="block whitespace-pre-line text-sm text-slate-600">{item.prizeDescription}</span>}</p> : <p className="text-sm text-slate-500">Todavía no hay premio.</p>}
    {item.prizeEditable && (hasRequiredBadge || item.prizeTitle ? <ActionForm action={savePrize} className="grid gap-2 rounded-xl bg-slate-50 p-3"><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="eventId" value={item.id} /><input className="rounded-xl border border-slate-200 px-3 py-2" name="prizeTitle" defaultValue={item.prizeTitle ?? ""} placeholder="Título del premio" maxLength={160} /><textarea className="rounded-xl border border-slate-200 px-3 py-2" name="prizeDescription" defaultValue={item.prizeDescription ?? ""} placeholder="Descripción" maxLength={1000} /><p className="text-sm text-slate-500">Se revela a quien complete todos los badges requeridos. Dejá el título vacío para quitar el premio.</p><button className="justify-self-start rounded-full bg-slate-800 px-4 py-2 font-bold text-white" type="submit">Guardar premio</button></ActionForm> : <p className="text-sm text-slate-500">Agregá un badge requerido para poder cargar un premio.</p>)}
  </section>;
}

function RaffleFields({ current }: { current?: { title: string; description: string | null; quantity: number } }) {
  return <>
    <input className="rounded-xl border border-slate-200 px-3 py-2" name="raffleTitle" defaultValue={current?.title} placeholder="Título del premio" required maxLength={160} />
    <textarea className="rounded-xl border border-slate-200 px-3 py-2" name="raffleDescription" defaultValue={current?.description ?? ""} placeholder="Descripción" maxLength={1000} />
    <input className="rounded-xl border border-slate-200 px-3 py-2" name="raffleQuantity" type="number" min={1} max={10000} defaultValue={current?.quantity ?? 1} aria-label="Cantidad" required />
  </>;
}

function RaffleSection({ companyId, item, raffle, hasRequiredBadge }: { companyId: string; item: { id: string; raffleDrawnAt: Date | null; canDrawRaffle: boolean }; raffle: Awaited<ReturnType<typeof listEventRaffle>>; hasRequiredBadge: boolean }) {
  const drawn = item.raffleDrawnAt !== null;
  const units = raffle.prizes.reduce((total, prize) => total + prize.quantity, 0);
  const hidden = <><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="eventId" value={item.id} /></>;
  if (!drawn && raffle.prizes.length === 0 && !hasRequiredBadge) return null;

  return <section className="grid gap-3 border-t border-slate-100 pt-4"><h3 className="font-black text-slate-800">Rifa</h3>
    {raffle.prizes.length === 0 ? <p className="text-sm text-slate-500">Todavía no hay premios en la rifa.</p> : <ul className="grid gap-2">{raffle.prizes.map((prize) => <li className="rounded-xl border border-slate-100 p-3" key={prize.id}>
      <div className="flex items-center justify-between gap-3"><span><strong>{prize.title}</strong><span className="ml-2 text-sm text-slate-500">×{prize.quantity}{drawn && ` · ${prize.assigned} asignados`}</span>{prize.description && <span className="block whitespace-pre-line text-sm text-slate-600">{prize.description}</span>}</span>
        {!drawn && <form action={deleteRafflePrize}>{hidden}<input type="hidden" name="prizeId" value={prize.id} /><button className="text-sm font-bold text-red-600" type="submit">Eliminar</button></form>}</div>
      {!drawn && <details><summary className="mt-2 cursor-pointer text-sm font-bold text-slate-700">Editar premio</summary><ActionForm action={saveRafflePrize} className="mt-3 grid gap-2">{hidden}<input type="hidden" name="prizeId" value={prize.id} /><RaffleFields current={prize} /><button className="justify-self-start rounded-full bg-slate-800 px-4 py-2 font-bold text-white" type="submit">Guardar premio</button></ActionForm></details>}
    </li>)}</ul>}
    {drawn ? <>
      <p className="text-sm text-slate-500">{raffle.winners.length} de {units} unidades asignadas</p>
      {raffle.winners.length > 0 && <ul className="grid gap-1 text-sm">{raffle.winners.map((winner) => <li key={winner.id}><strong>{winner.userName}</strong> · {winner.prizeTitle} · {winner.claimedAt ? `reclamó el ${winner.claimedAt.toLocaleDateString("es")}` : "sin reclamar"}</li>)}</ul>}
    </> : <>
      <ActionForm action={saveRafflePrize} className="grid gap-2 rounded-xl bg-slate-50 p-3">{hidden}<RaffleFields /><button className="justify-self-start rounded-full bg-slate-800 px-4 py-2 font-bold text-white" type="submit">Agregar premio a la rifa</button></ActionForm>
      {raffle.prizes.length > 0 && <ActionForm action={drawRaffle} className="grid gap-2">{hidden}<p className="text-sm text-slate-500">{item.canDrawRaffle ? "El sorteo se hace una sola vez, entre quienes completaron el evento. Un premio por persona." : "Se puede sortear cuando termina el evento."}</p><button className="justify-self-start rounded-full bg-[#71ceff] px-4 py-2 font-bold text-slate-800 disabled:opacity-50" disabled={!item.canDrawRaffle} type="submit">Sortear</button></ActionForm>}
    </>}
  </section>;
}

export default async function CompanyHomePage({ params }: { params: Promise<{ companyId: string }> }) {
  const { companyId } = await params;
  const company = await getMyCompany(companyId);
  const events = await listMyCompanyEvents(companyId);
  const photos = await listPhotosForEvents(events.map((item) => item.id));
  const photosByEvent = new Map<string, typeof photos>();
  for (const photo of photos) {
    const current = photosByEvent.get(photo.eventId) ?? [];
    current.push(photo);
    photosByEvent.set(photo.eventId, current);
  }
  const eventsWithBadges = await Promise.all(events.map(async (item) => ({ item, badges: await listEventBadges(companyId, item.id), raffle: await listEventRaffle(companyId, item.id) })));

  if (!company) notFound();

  return <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-start justify-center gap-6 px-6">
    <p className="inline-flex rounded-full bg-[#add195]/40 px-4 py-2 text-sm font-bold text-slate-700">Administrás esta empresa</p>
    <h1 className="text-4xl font-black tracking-tight text-slate-800">{company.name}</h1>
    <p className="text-lg text-slate-600">Creá y administrá los eventos de tu empresa.</p>
    <CreateEventForm companyId={companyId} />
    <section className="w-full scroll-mt-20" id="eventos"><h2 className="mt-8 text-xl font-black text-slate-800">Eventos</h2>{events.length === 0 ? <p className="mt-3 text-slate-600">Todavía no hay eventos.</p> : <EventListFilter items={eventsWithBadges.map(({ item, badges, raffle }) => ({ id: item.id, name: item.name, status: item.status, startsAt: item.startsAt.getTime(), node: <>
      <div className="flex items-center justify-between gap-3"><div><strong>{item.name}</strong><p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500"><EventStatusBadge status={item.status} />{item.startsAt.toLocaleString()}{eventPlaceSummary(item) ? ` · ${eventPlaceSummary(item)}` : ""}</p></div><div className="flex items-center gap-3"><Link className="text-sm font-bold text-slate-700" href={`/company/${companyId}/events/${item.id}/asistencia`}>Asistentes</Link>{item.status === "ACTIVE" && <Link className="text-sm font-bold text-slate-700" href={`/company/${companyId}/events/${item.id}/qr`}>QR de check-in</Link>}{item.canActivate && (badges.length === 0 ? <span className="text-sm text-slate-500">Agregá un badge para activarlo</span> : item.prizeTitle && !badges.some((badge) => badge.required) ? <span className="text-sm text-slate-500">Con premio, agregá un badge requerido para activarlo</span> : <ActivateEventButton companyId={companyId} eventId={item.id} />)}</div></div>
      <EventPhotoGallery companyId={companyId} eventId={item.id} eventName={item.name} manage photos={photosByEvent.get(item.id) ?? []} />
      {item.status === "DRAFT" && <details><summary className="cursor-pointer text-sm font-bold text-slate-700">Editar evento</summary><ActionForm action={updateEvent} className="mt-3 grid gap-3"><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="eventId" value={item.id} /><input className="rounded-xl border border-slate-200 px-4 py-3" name="name" defaultValue={item.name} required maxLength={160} /><input className="rounded-xl border border-slate-200 px-4 py-3" name="slug" defaultValue={item.slug} required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" maxLength={100} /><textarea className="rounded-xl border border-slate-200 px-4 py-3" name="description" defaultValue={item.description ?? ""} /><EventPlaceFields location={item.location} country={item.country} modality={item.modality} /><input className="rounded-xl border border-slate-200 px-4 py-3" type="datetime-local" name="startsAt" defaultValue={item.startsAt.toISOString().slice(0, 16)} required /><input className="rounded-xl border border-slate-200 px-4 py-3" type="datetime-local" name="endsAt" defaultValue={item.endsAt.toISOString().slice(0, 16)} required /><button className="justify-self-start rounded-full bg-slate-800 px-4 py-2 font-bold text-white" type="submit">Guardar cambios</button></ActionForm></details>}
      {item.status === "DRAFT" && <form action={deleteEvent}><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="eventId" value={item.id} /><button className="justify-self-start text-sm font-bold text-red-600" type="submit">Eliminar</button></form>}
      <section className="grid gap-3 border-t border-slate-100 pt-4"><h3 className="font-black text-slate-800">Badges</h3>{badges.length === 0 ? <p className="text-sm text-slate-500">Todavía no hay badges.</p> : <ul className="grid gap-2">{badges.map((badge) => <li className="rounded-xl border border-slate-100 p-3" key={badge.id}><div className="flex items-center justify-between gap-3"><span><strong>{badge.icon ? `${badge.icon} ` : ""}{badge.name}</strong><span className="ml-2 text-sm text-slate-500">{badge.type} · {badge.rarity} · {badge.xp} XP{badge.required ? " · requerido" : " · opcional"}</span></span><div className="flex items-center gap-3">{item.status === "ACTIVE" && <Link className="text-sm font-bold text-slate-700" href={`/company/${companyId}/events/${item.id}/qr?badge=${badge.id}`}>Mostrar QR</Link>}{item.status === "DRAFT" && <form action={deleteBadge}><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="eventId" value={item.id} /><input type="hidden" name="badgeId" value={badge.id} /><button className="text-sm font-bold text-red-600" type="submit">Eliminar</button></form>}</div></div>{item.status === "DRAFT" && <details><summary className="mt-2 cursor-pointer text-sm font-bold text-slate-700">Editar badge</summary><ActionForm action={updateBadge} className="mt-3 grid gap-2"><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="eventId" value={item.id} /><input type="hidden" name="badgeId" value={badge.id} /><BadgeFields current={badge} /><button className="justify-self-start rounded-full bg-slate-800 px-4 py-2 font-bold text-white" type="submit">Guardar badge</button></ActionForm></details>}</li>)}</ul>}{item.status !== "FINISHED" && <ActionForm action={createBadge} className="grid gap-2 rounded-xl bg-slate-50 p-3"><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="eventId" value={item.id} /><BadgeFields optionalOnly={item.status === "ACTIVE"} /><button className="justify-self-start rounded-full bg-slate-800 px-4 py-2 font-bold text-white" type="submit">Crear badge</button></ActionForm>}</section>
      <PrizeSection companyId={companyId} hasRequiredBadge={badges.some((badge) => badge.required)} item={item} />
      <RaffleSection companyId={companyId} hasRequiredBadge={badges.some((badge) => badge.required)} item={item} raffle={raffle} />
    </> }))} />}</section>
  </main>;
}
