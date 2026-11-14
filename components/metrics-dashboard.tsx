import Form from "next/form";
import Link from "next/link";
import type { BadgeTypeFilter, MetricsSnapshot, TrafficHour } from "@/app/lib/metrics";
import { EventStatusBadge } from "@/components/event-status-badge";

const BADGE_TYPE_LABELS: Record<string, string> = {
  CONTENT: "Contenido",
  TALK: "Charla",
  STAND: "Stand",
};

export function MetricsDashboard({
  actionPath,
  snapshot,
  attendanceCompanyId,
}: {
  actionPath: string;
  snapshot: MetricsSnapshot;
  attendanceCompanyId: string | null;
}) {
  const selectedEvent = snapshot.events.find((item) => item.id === snapshot.eventId) ?? null;
  const filtersActive = snapshot.eventId !== null || snapshot.badgeType !== "ALL";

  return (
    <div className="flex w-full flex-col gap-8">
      <Form action={actionPath} className="grid w-full gap-3 sm:grid-cols-2">
        <FilterField label="Evento" name="event" value={snapshot.eventId ?? ""}>
          <option value="">Todos</option>
          {snapshot.events.map((item) => (
            <option key={item.id} value={item.id}>
              {snapshot.scopeKind === "platform" ? `${item.companyName} · ${item.name}` : item.name}
            </option>
          ))}
        </FilterField>
        <FilterField label="Tipo de badge" name="type" value={snapshot.badgeType === "ALL" ? "" : snapshot.badgeType}>
          <option value="">Todos</option>
          <option value="TALK">Charlas</option>
          <option value="STAND">Stands</option>
        </FilterField>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <button className="min-h-12 rounded-full bg-slate-800 px-6 py-3 text-sm font-bold text-white" type="submit">
            Filtrar
          </button>
          {filtersActive && (
            <Link className="min-h-12 rounded-full px-4 py-3 text-sm font-bold text-slate-700" href={actionPath}>
              Quitar filtros
            </Link>
          )}
        </div>
      </Form>

      {selectedEvent && (
        <p className="text-sm text-slate-600">
          Mostrando <strong className="text-slate-800">{selectedEvent.name}</strong>.
        </p>
      )}

      <section aria-label="Resumen">
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {summaryCards(snapshot).map((card) => (
            <li className="rounded-3xl bg-white p-4 shadow-sm" key={card.label}>
              <p className="text-3xl font-black tracking-tight text-slate-800">{card.value}</p>
              <p className="mt-1 text-sm text-slate-500">{card.label}</p>
            </li>
          ))}
        </ul>
      </section>

      <TrafficChart traffic={snapshot.traffic} />
      <TopBadges snapshot={snapshot} />

      {snapshot.topEvents && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-black text-slate-800">Eventos con más check-ins</h2>
          {snapshot.topEvents.length === 0 ? (
            <p className="rounded-3xl bg-white p-6 text-slate-600">Todavía no hay check-ins.</p>
          ) : (
            <ol className="flex flex-col gap-3">
              {snapshot.topEvents.map((item) => (
                <li className="rounded-3xl bg-white p-4 shadow-sm" key={item.eventId}>
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p>
                      <Link className="font-black text-slate-800 hover:text-[#71ceff]" href={metricsHref(actionPath, item.eventId, snapshot.badgeType)}>
                        {item.name}
                      </Link>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        <Link className="font-bold text-slate-600 hover:text-[#71ceff]" href={`/admin/companies/${item.companyId}`}>
                          {item.companyName}
                        </Link>
                        <EventStatusBadge status={item.status} />
                      </span>
                    </p>
                    <span className="text-lg font-black text-slate-800">{item.checkIns}</span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      )}

      {attendanceCompanyId && (
        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-black text-slate-800">Asistencia por evento</h2>
          {snapshot.events.length === 0 ? (
            <p className="rounded-3xl bg-white p-6 text-slate-600">Todavía no hay eventos.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {snapshot.events.map((item) => (
                <li className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-4 shadow-sm" key={item.id}>
                  <p>
                    <span className="font-black text-slate-800">{item.name}</span>
                    <span className="mt-1 block text-sm text-slate-500">{item.checkIns} check-ins</span>
                  </p>
                  <Link className="text-sm font-bold text-slate-700" href={`/company/${attendanceCompanyId}/events/${item.id}/asistencia`}>
                    Asistentes
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function TrafficChart({ traffic }: { traffic: TrafficHour[] }) {
  const busiest = traffic.reduce((max, hour) => Math.max(max, hour.arrivals, hour.redemptions), 0);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-black text-slate-800">Horario de afluencia</h2>
      <p className="text-sm text-slate-600">Hora de Costa Rica. La barra celeste son las llegadas y la verde los canjes.</p>
      <ul className="flex flex-wrap gap-4 text-sm text-slate-600">
        <li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-[#71ceff]" />Llegadas</li>
        <li className="flex items-center gap-2"><span aria-hidden="true" className="inline-block h-3 w-3 rounded-full bg-[#add195]" />Canjes</li>
      </ul>
      <ol className="flex flex-col gap-2 rounded-3xl bg-white p-4 shadow-sm">
        {traffic.map((hour) => (
          <li
            aria-label={`${hour.hour} h: ${hour.arrivals} llegadas, ${hour.redemptions} canjes`}
            className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-2 text-sm"
            key={hour.hour}
          >
            <span className="text-slate-500">{hour.hour} h</span>
            <span className="flex flex-col gap-1">
              <Bar className="bg-[#71ceff]" max={busiest} value={hour.arrivals} />
              <Bar className="bg-[#add195]" max={busiest} value={hour.redemptions} />
            </span>
            <span className="text-right text-slate-700">{hour.arrivals}/{hour.redemptions}</span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Bar({ className, max, value }: { className: string; max: number; value: number }) {
  const width = max <= 0 || value <= 0 ? 0 : Math.max(4, Math.round((value / max) * 100));

  return (
    <span className="block h-2 rounded-full bg-slate-100">
      <span className={`block h-2 rounded-full ${className}`} style={{ width: `${width}%` }} />
    </span>
  );
}

function TopBadges({ snapshot }: { snapshot: MetricsSnapshot }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xl font-black text-slate-800">Charlas y stands más canjeados</h2>
      {snapshot.topBadges.length === 0 ? (
        <p className="rounded-3xl bg-white p-6 text-slate-600">{emptyBadgesCopy(snapshot.badgeType)}</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {snapshot.topBadges.map((badge) => (
            <li className="flex items-baseline justify-between gap-3 rounded-3xl bg-white p-4 shadow-sm" key={badge.badgeId}>
              <p>
                <span className="font-black text-slate-800">{badge.name}</span>
                <span className="mt-1 block text-sm text-slate-500">
                  {snapshot.scopeKind === "platform" ? `${badge.companyName} · ` : ""}
                  {badge.eventName} · {badgeTypeLabel(badge.type)}
                </span>
              </p>
              <span className="text-lg font-black text-slate-800">{badge.redemptions}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function FilterField({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-bold text-slate-700">
      {label}
      <select className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal text-slate-800" defaultValue={value} name={name}>
        {children}
      </select>
    </label>
  );
}

function summaryCards(snapshot: MetricsSnapshot) {
  const attendeesLabel = snapshot.scopeKind === "company" ? "Asistentes" : "Check-ins";
  const cards = [
    snapshot.cards.companies === null ? null : { label: "Empresas", value: snapshot.cards.companies },
    snapshot.cards.users === null ? null : { label: "Usuarios", value: snapshot.cards.users },
    { label: "Eventos activos", value: snapshot.cards.events.active },
    { label: "Borradores", value: snapshot.cards.events.draft },
    { label: "Finalizados", value: snapshot.cards.events.finished },
    { label: attendeesLabel, value: snapshot.cards.checkIns },
    { label: "Canjes", value: snapshot.cards.redemptions },
    { label: "Completaron", value: snapshot.cards.completions },
  ];

  return cards.filter((card): card is { label: string; value: number } => card !== null);
}

function emptyBadgesCopy(badgeType: BadgeTypeFilter) {
  if (badgeType === "TALK") return "Ninguna charla tiene canjes.";
  if (badgeType === "STAND") return "Ningún stand tiene canjes.";
  return "Todavía no hay canjes.";
}

function badgeTypeLabel(type: string) {
  return BADGE_TYPE_LABELS[type] ?? type;
}

function metricsHref(actionPath: string, eventId: string, badgeType: BadgeTypeFilter) {
  const query = new URLSearchParams();
  query.set("event", eventId);
  if (badgeType !== "ALL") query.set("type", badgeType);
  return `${actionPath}?${query.toString()}`;
}
