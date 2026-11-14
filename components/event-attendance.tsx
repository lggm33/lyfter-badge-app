import Link from "next/link";
import type { AttendeeRow, BadgeRedemptionPage, EventAttendance } from "@/app/lib/attendance";

type PageState = { page: number; badgeId: string | null; badgePage: number };

export function EventAttendanceView({
  basePath,
  attendance,
}: {
  basePath: string;
  attendance: EventAttendance;
}) {
  const state: PageState = {
    page: attendance.page,
    badgeId: attendance.badgeId,
    badgePage: attendance.badges.find((item) => item.badgeId === attendance.badgeId)?.page ?? 1,
  };

  return (
    <div className="flex w-full flex-col gap-8">
      <section className="flex w-full flex-col gap-3">
        <h2 className="text-xl font-black text-slate-800">Asistentes</h2>
        {attendance.attendees.length === 0 ? (
          <p className="rounded-3xl bg-white p-6 text-slate-600">
            {attendance.page > 1 ? "No hay más asistentes." : "Todavía no hay asistentes."}
          </p>
        ) : (
          <ol className="flex w-full flex-col gap-3">
            {attendance.attendees.map((row) => (
              <li className="rounded-3xl bg-white p-4 shadow-sm" key={row.userId}>
                <p className="font-black text-slate-800">{row.name}</p>
                <p className="mt-1 text-sm text-slate-600">{attendeeSummary(row)}</p>
              </li>
            ))}
          </ol>
        )}
        <PageNav
          label="Páginas de asistentes"
          next={attendance.hasNextPage ? attendanceHref(basePath, state, { page: attendance.page + 1 }) : null}
          previous={attendance.page > 1 ? attendanceHref(basePath, state, { page: attendance.page - 1 }) : null}
        />
      </section>

      {attendance.badges.map((item) => (
        <BadgeRedemptions basePath={basePath} item={item} key={item.badgeId} state={state} />
      ))}
    </div>
  );
}

function BadgeRedemptions({
  basePath,
  item,
  state,
}: {
  basePath: string;
  item: BadgeRedemptionPage;
  state: PageState;
}) {
  const title = item.icon ? `${item.icon} ${item.name}` : item.name;

  return (
    <section className="flex w-full flex-col gap-3">
      <h2 className="text-xl font-black text-slate-800">{title}</h2>
      {item.rows.length === 0 ? (
        <p className="rounded-3xl bg-white p-6 text-slate-600">
          {item.page > 1 ? "No hay más canjes." : "Todavía nadie canjeó este badge."}
        </p>
      ) : (
        <ol className="flex w-full flex-col gap-3">
          {item.rows.map((row) => (
            <li className="rounded-3xl bg-white p-4 shadow-sm" key={row.userId}>
              <p className="font-bold text-slate-800">{row.name}</p>
              <p className="mt-1 text-sm text-slate-600">canjeó el {row.redeemedAt.toLocaleString("es")}</p>
            </li>
          ))}
        </ol>
      )}
      <PageNav
        label={`Páginas de ${item.name}`}
        next={item.hasNextPage ? attendanceHref(basePath, state, { badgeId: item.badgeId, badgePage: item.page + 1 }) : null}
        previous={item.page > 1 ? attendanceHref(basePath, state, { badgeId: item.badgeId, badgePage: item.page - 1 }) : null}
      />
    </section>
  );
}

function PageNav({ label, previous, next }: { label: string; previous: string | null; next: string | null }) {
  if (!previous && !next) return null;

  return (
    <nav aria-label={label} className="flex w-full justify-between gap-3">
      {previous ? <PageLink href={previous} label="← Anterior" /> : <span />}
      {next ? <PageLink href={next} label="Siguiente →" /> : null}
    </nav>
  );
}

function PageLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="min-h-12 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700" href={href}>
      {label}
    </Link>
  );
}

function attendeeSummary(row: AttendeeRow) {
  const badges = row.badgeCount === 1 ? "1 badge" : `${row.badgeCount} badges`;
  const completion = row.completed ? "completó" : "no completó";
  return `${row.email} · check-in ${row.checkedInAt.toLocaleString("es")} · ${badges} · ${completion}`;
}

function attendanceHref(basePath: string, state: PageState, next: Partial<PageState>) {
  const page = next.page ?? state.page;
  const badgeId = next.badgeId === undefined ? state.badgeId : next.badgeId;
  const badgePage = next.badgePage ?? (badgeId === state.badgeId ? state.badgePage : 1);
  const query = new URLSearchParams();
  if (page > 1) query.set("page", String(page));
  if (badgeId && badgePage > 1) {
    query.set("badge", badgeId);
    query.set("badgePage", String(badgePage));
  }
  const search = query.toString();
  return search ? `${basePath}?${search}` : basePath;
}
