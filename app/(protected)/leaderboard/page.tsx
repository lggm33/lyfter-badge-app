import Form from "next/form";
import Link from "next/link";
import { requireSession } from "@/app/lib/authz";
import {
  getLeaderboardPage,
  getLeaderboardPosition,
  listLeaderboardEvents,
  parseLeaderboardSort,
  type LeaderboardRow,
  type LeaderboardSort,
} from "@/app/lib/leaderboard";

type Params = { event?: string | string[]; sort?: string | string[]; page?: string | string[] };

const SORT_LABELS: Record<LeaderboardSort, string> = { xp: "XP", talks: "Charlas", stands: "Stands" };

export default async function LeaderboardPage({ searchParams }: { searchParams?: Promise<Params> } = {}) {
  const session = await requireSession();
  const params = searchParams ? await searchParams : {};
  const events = await listLeaderboardEvents();
  const selected = events.find((item) => item.id === firstValue(params.event)) ?? null;
  const eventId = selected?.id ?? null;
  const sort = parseLeaderboardSort(firstValue(params.sort));
  const page = Math.max(1, Number.parseInt(firstValue(params.page), 10) || 1);

  const [board, me] = await Promise.all([
    getLeaderboardPage({ eventId, sort, page }),
    getLeaderboardPosition({ eventId, sort, userId: session.user.id }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-6">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#71ceff]">Ranking</p>
      <h1 className="text-4xl font-black tracking-tight text-slate-800">{selected?.name ?? "Global"}</h1>

      <Form action="/leaderboard" className="flex w-full flex-col gap-3 sm:flex-row">
        <input name="sort" type="hidden" value={sort} />
        <label className="sr-only" htmlFor="leaderboard-event">Evento</label>
        <select
          className="min-h-12 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-slate-800"
          defaultValue={eventId ?? ""}
          id="leaderboard-event"
          name="event"
        >
          <option value="">Global</option>
          {events.map((item) => (
            <option key={item.id} value={item.id}>{item.name} · {item.companyName}</option>
          ))}
        </select>
        <button className="min-h-12 rounded-full bg-slate-800 px-6 py-3 text-sm font-bold text-white" type="submit">
          Ver ranking
        </button>
      </Form>

      <nav aria-label="Ordenar por" className="grid w-full grid-cols-3 gap-2">
        {(Object.keys(SORT_LABELS) as LeaderboardSort[]).map((item) => (
          <Link
            aria-current={item === sort ? "page" : undefined}
            className={`min-h-12 rounded-full px-3 py-3 text-center text-sm font-bold ${item === sort ? "bg-slate-800 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
            href={leaderboardHref(eventId, item, 1)}
            key={item}
          >
            {SORT_LABELS[item]}
          </Link>
        ))}
      </nav>

      <section aria-label="Tu posición" className="w-full rounded-3xl border border-[#add195] bg-[#add195]/30 p-4">
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-slate-700">Tu posición</p>
        {me ? (
          <p className="mt-1 text-2xl font-black text-slate-800">#{me.position} · {metricLabel(me, sort)}</p>
        ) : (
          <p className="mt-1 text-slate-700">Todavía no estás en el ranking.</p>
        )}
      </section>

      {board.rows.length === 0 ? (
        <p className="text-slate-600">{page > 1 ? "No hay más puestos." : "Todavía nadie sumó puntos acá."}</p>
      ) : (
        <ol className="flex w-full flex-col gap-2">
          {board.rows.map((row) => (
            <li
              className={`flex items-center gap-3 rounded-3xl border p-4 ${row.userId === session.user.id ? "border-[#71ceff] bg-[#71ceff]/10" : "border-slate-200 bg-white"}`}
              key={row.userId}
            >
              <span className="w-12 shrink-0 font-black text-slate-500">#{row.position}</span>
              <span className="min-w-0 flex-1 truncate font-bold text-slate-800">{row.name}</span>
              <span className="shrink-0 text-sm font-semibold text-slate-600">{metricLabel(row, sort)}</span>
            </li>
          ))}
        </ol>
      )}

      {(page > 1 || board.hasNextPage) && (
        <nav aria-label="Páginas" className="flex w-full justify-between gap-3">
          {page > 1 ? <PageLink href={leaderboardHref(eventId, sort, page - 1)} label="← Anterior" /> : <span />}
          {board.hasNextPage && <PageLink href={leaderboardHref(eventId, sort, page + 1)} label="Siguiente →" />}
        </nav>
      )}
    </div>
  );
}

function PageLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="min-h-12 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700" href={href}>
      {label}
    </Link>
  );
}

function metricLabel(row: LeaderboardRow, sort: LeaderboardSort) {
  if (sort === "talks") return `${row.talks} ${row.talks === 1 ? "charla" : "charlas"}`;
  if (sort === "stands") return `${row.stands} ${row.stands === 1 ? "stand" : "stands"}`;
  return `${row.xp} XP`;
}

function leaderboardHref(eventId: string | null, sort: LeaderboardSort, page: number) {
  const query = new URLSearchParams({ sort });
  if (eventId) query.set("event", eventId);
  if (page > 1) query.set("page", String(page));
  return `/leaderboard?${query}`;
}

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
