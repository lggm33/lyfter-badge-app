import Link from "next/link";
import { EventPhotoGallery } from "@/components/event-photo-gallery";
import { claimPrize, claimRaffleWin, type listMyCollection } from "@/app/(protected)/home/actions";

type History = Awaited<ReturnType<typeof listMyCollection>>;

export function EventHistory({ events }: { events: History["events"] }) {
  if (events.length === 0) {
    return (
      <section className="flex w-full flex-col items-start gap-3">
        <p className="text-slate-600">Todavía no estás en ningún evento.</p>
        <ScanLink label="Escanear el QR de bienvenida" />
      </section>
    );
  }

  return (
    <div className="flex w-full flex-col gap-8">
      {events.map((item) => (
        <EventSection event={item} key={item.eventId} />
      ))}
    </div>
  );
}

function EventSection({ event }: { event: History["events"][number] }) {
  return (
    <section className="flex w-full scroll-mt-6 flex-col items-start gap-3" id={eventAnchor(event.eventId)}>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#71ceff]">
          {event.eventName} · {event.xp} XP
        </h2>
        {event.completed && (
          <span className="rounded-full bg-[#d798e7]/30 px-3 py-1 text-xs font-bold text-slate-800">Completado</span>
        )}
      </div>
      {event.place && <p className="text-sm text-slate-500">{event.place}</p>}
      {event.photos.length > 0 && (
        <EventPhotoGallery eventId={event.eventId} eventName={event.eventName} photos={event.photos} />
      )}
      {event.requiredTotal > 0 && <RequiredProgress redeemed={event.requiredRedeemed} total={event.requiredTotal} />}
      {event.prize && <Prize eventId={event.eventId} prize={event.prize} />}
      {event.raffle && <Raffle raffle={event.raffle} />}
      {event.badges.length === 0 ? <EmptyEvent /> : <BadgeList badges={event.badges} />}
    </section>
  );
}

function RequiredProgress({ redeemed, total }: { redeemed: number; total: number }) {
  return (
    <div className="flex w-full flex-col gap-1">
      <p className="text-sm text-slate-600">
        {redeemed} de {total} requeridos
      </p>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-[#71ceff]" style={{ width: `${(redeemed / total) * 100}%` }} />
      </div>
    </div>
  );
}

function Prize({ eventId, prize }: { eventId: string; prize: NonNullable<History["events"][number]["prize"]> }) {
  if (prize.status === "locked") {
    return (
      <p className="w-full rounded-3xl border border-dashed border-slate-300 p-4 text-slate-600">
        Completá los badges requeridos para revelar el premio.
      </p>
    );
  }

  return (
    <div className="w-full rounded-3xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#d798e7]">Premio</p>
      <p className="mt-1 font-black text-slate-800">{prize.title}</p>
      {prize.description && <p className="mt-1 whitespace-pre-line text-slate-600">{prize.description}</p>}
      {prize.status === "claimed" ? (
        <p className="mt-3 text-sm text-slate-500">Reclamado el {prize.claimedAt.toLocaleDateString("es")}</p>
      ) : (
        <form action={claimPrize.bind(null, eventId)}>
          <button className="mt-3 rounded-full bg-slate-800 px-5 py-3 text-sm font-bold text-white" type="submit">
            Reclamar
          </button>
        </form>
      )}
    </div>
  );
}

function Raffle({ raffle }: { raffle: NonNullable<History["events"][number]["raffle"]> }) {
  if (raffle.status === "locked") {
    return (
      <p className="w-full rounded-3xl border border-dashed border-slate-300 p-4 text-slate-600">
        Completá los badges requeridos para participar de la rifa.
      </p>
    );
  }
  if (raffle.status === "not_drawn") {
    return <p className="w-full rounded-3xl border border-slate-200 bg-white p-4 text-slate-600">No saliste sorteado.</p>;
  }

  return (
    <div className="w-full rounded-3xl border border-slate-200 bg-white p-4">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#d798e7]">Rifa</p>
      {raffle.status === "participating" ? (
        <p className="mt-1 text-slate-600">
          Participás por: {raffle.prizes.map((prize) => (prize.quantity > 1 ? `${prize.title} ×${prize.quantity}` : prize.title)).join(", ")}
        </p>
      ) : (
        <>
          <p className="mt-1 font-black text-slate-800">¡Ganaste {raffle.title}!</p>
          {raffle.description && <p className="mt-1 whitespace-pre-line text-slate-600">{raffle.description}</p>}
          {raffle.claimedAt ? (
            <p className="mt-3 text-sm text-slate-500">Reclamado el {raffle.claimedAt.toLocaleDateString("es")}</p>
          ) : (
            <form action={claimRaffleWin.bind(null, raffle.winId)}>
              <button className="mt-3 rounded-full bg-slate-800 px-5 py-3 text-sm font-bold text-white" type="submit">
                Reclamar
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

export function eventAnchor(eventId: string) {
  return `event-${eventId}`;
}

function EmptyEvent() {
  return (
    <div className="w-full rounded-3xl border border-slate-200 bg-white p-4">
      <p className="text-slate-600">Todavía no reclamaste badges en este evento.</p>
      <ScanLink label="Escanear un badge" />
    </div>
  );
}

function BadgeList({ badges }: { badges: History["events"][number]["badges"] }) {
  return (
    <ul className="grid w-full gap-3 sm:grid-cols-2">
      {badges.map((item) => (
        <li key={item.redemptionId}>
          <Link className="block rounded-3xl border border-slate-200 bg-white p-4" href={`/badge/${item.badgeId}`}>
            <p className="font-black text-slate-800">{badgeTitle(item.icon, item.name)}</p>
            <p className="mt-1 text-sm text-slate-500">{item.xp} XP</p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ScanLink({ label }: { label: string }) {
  return (
    <Link
      className="mt-3 inline-flex rounded-full bg-slate-800 px-5 py-3 text-sm font-bold text-white"
      href="/scan"
    >
      {label}
    </Link>
  );
}

function badgeTitle(icon: string | null, name: string) {
  if (!icon) return name;
  return `${icon} ${name}`;
}
