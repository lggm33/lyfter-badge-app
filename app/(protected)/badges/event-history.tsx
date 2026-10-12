import Link from "next/link";
import type { listMyCollection } from "@/app/(protected)/home/actions";

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
    <section className="flex w-full flex-col items-start gap-3">
      <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-[#71ceff]">
        {event.eventName} · {event.xp} XP
      </h2>
      {event.badges.length === 0 ? <EmptyEvent /> : <BadgeList badges={event.badges} />}
    </section>
  );
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

function ScanLink({ label }: { label: string }) {
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
