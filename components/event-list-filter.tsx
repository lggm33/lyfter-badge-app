"use client";

import { useState, type ReactNode } from "react";
import { EVENT_STATUS } from "@/components/event-status-badge";

type EventItem = { id: string; name: string; status: string; startsAt: number; node: ReactNode };

/** Accent- and case-insensitive, so "convencion" finds "Convención". */
function normalize(text: string) {
  return text.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase();
}

export function filterEvents<T extends Omit<EventItem, "node">>(
  items: T[],
  { query, status, order }: { query: string; status: string; order: "desc" | "asc" },
) {
  const needle = normalize(query.trim());
  return items
    .filter((item) => (!status || item.status === status) && normalize(item.name).includes(needle))
    .sort((a, b) => (order === "desc" ? b.startsAt - a.startsAt : a.startsAt - b.startsAt));
}

// ponytail: filters what the page already loaded; move to the query if a company outgrows one page of events.
export function EventListFilter({ items }: { items: EventItem[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [order, setOrder] = useState<"desc" | "asc">("desc");

  // The tree must not reorder or drop server-rendered cards (React DevTools throws on it, and an
  // open edit form would lose its input): filtering only toggles `hidden`, and a new order remounts the list.
  const sorted = filterEvents(items, { query: "", status: "", order });
  const visibleIds = new Set(filterEvents(items, { query, status, order }).map((item) => item.id));

  return (
    <>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          aria-label="Buscar evento por nombre"
          className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre"
          type="search"
          value={query}
        />
        <select aria-label="Filtrar por estado" className="rounded-xl border border-slate-200 bg-white px-3 py-2" onChange={(e) => setStatus(e.target.value)} value={status}>
          <option value="">Todos los estados</option>
          {Object.entries(EVENT_STATUS).map(([value, { label }]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
        <select aria-label="Ordenar por fecha" className="rounded-xl border border-slate-200 bg-white px-3 py-2" onChange={(e) => setOrder(e.target.value as "desc" | "asc")} value={order}>
          <option value="desc">Más recientes primero</option>
          <option value="asc">Más antiguos primero</option>
        </select>
      </div>
      {visibleIds.size === 0 && <p className="mt-3 text-slate-600">Ningún evento coincide con el filtro.</p>}
      <ul className="mt-3 grid gap-3" key={order}>
        {sorted.map((item) => (
          <li className="grid gap-4 rounded-2xl bg-white p-5 shadow-sm" hidden={!visibleIds.has(item.id)} key={item.id}>{item.node}</li>
        ))}
      </ul>
    </>
  );
}
