import { notFound } from "next/navigation";
import { CreateEventForm } from "@/components/create-event-form";
import { EventPhotoGallery } from "@/components/event-photo-gallery";
import { EventListFilter } from "@/components/event-list-filter";
import { listPhotosForEvents } from "@/app/lib/event-photos";
import { DeleteEventForm, EventBadgeList, EventEditor, EventSummary, PrizeSection, RaffleSection } from "./event-sections";
import { getMyCompany, listEventBadges, listEventRaffle, listMyCompanyEvents } from "./actions";

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
  const eventsWithBadges = await Promise.all(events.map(async (item) => ({
    item,
    badges: await listEventBadges(companyId, item.id),
    raffle: await listEventRaffle(companyId, item.id),
  })));

  if (!company) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-start justify-center gap-6 px-6">
      <p className="inline-flex rounded-full bg-[#add195]/40 px-4 py-2 text-sm font-bold text-slate-700">Administrás esta empresa</p>
      <h1 className="text-4xl font-black tracking-tight text-slate-800">{company.name}</h1>
      <p className="text-lg text-slate-600">Creá y administrá los eventos de tu empresa.</p>
      <CreateEventForm companyId={companyId} />
      <section className="w-full scroll-mt-20" id="eventos">
        <h2 className="mt-8 text-xl font-black text-slate-800">Eventos</h2>
        {events.length === 0 ? (
          <p className="mt-3 text-slate-600">Todavía no hay eventos.</p>
        ) : (
          <EventListFilter items={eventsWithBadges.map(({ item, badges, raffle }) => ({
            id: item.id,
            name: item.name,
            status: item.status,
            startsAt: item.startsAt.getTime(),
            node: (
              <>
                <EventSummary badges={badges} companyId={companyId} item={item} />
                <EventPhotoGallery companyId={companyId} eventId={item.id} eventName={item.name} manage photos={photosByEvent.get(item.id) ?? []} />
                {item.status === "DRAFT" && <EventEditor companyId={companyId} item={item} />}
                {item.status === "DRAFT" && <DeleteEventForm companyId={companyId} eventId={item.id} />}
                <EventBadgeList badges={badges} companyId={companyId} item={item} />
                <PrizeSection companyId={companyId} hasRequiredBadge={badges.some((badge) => badge.required)} item={item} />
                <RaffleSection companyId={companyId} hasRequiredBadge={badges.some((badge) => badge.required)} item={item} raffle={raffle} />
              </>
            ),
          }))} />
        )}
      </section>
    </main>
  );
}
