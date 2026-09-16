"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  assignCompanyAdmin,
  searchAssignableUsers,
  type AssignableUser,
} from "../actions";
import { USER_SEARCH_MIN_LENGTH } from "@/app/lib/user-search";

const SEARCH_DEBOUNCE_MS = 300;

export function AssignCompanyAdminForm({ companyId }: { companyId: string }) {
  const listId = useId();
  const requestId = useRef(0);
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<AssignableUser[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [selected, setSelected] = useState<AssignableUser | null>(null);

  const trimmedQuery = query.trim();
  const isFiltering = trimmedQuery.length >= USER_SEARCH_MIN_LENGTH;

  useEffect(() => {
    if (selected) {
      return;
    }

    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    const delay = isFiltering ? SEARCH_DEBOUNCE_MS : 0;

    const timer = window.setTimeout(async () => {
      setIsSearching(true);
      const page = await searchAssignableUsers(query, companyId);

      if (requestId.current !== currentRequest) {
        return;
      }

      setUsers(page.users);
      setHasMore(page.hasMore);
      setIsSearching(false);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [companyId, isFiltering, query, selected]);

  const visibleUsers = selected ? [] : users;

  function selectUser(user: AssignableUser) {
    setSelected(user);
    setQuery(`${user.name} · ${user.email}`);
  }

  function handleQueryChange(value: string) {
    setSelected(null);
    setQuery(value);
  }

  return (
    <form action={assignCompanyAdmin} className="rounded-3xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black text-slate-800">Asignar administrador</h2>
      <p className="mt-2 text-sm text-slate-600">
        Hasta 20 usuarios, ordenados por nombre. Escribí para filtrar.
      </p>
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="userId" value={selected?.id ?? ""} />

      <label className="mt-6 block text-sm font-bold text-slate-700" htmlFor="user-search">
        Usuario
      </label>
      <input
        className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
        id="user-search"
        role="combobox"
        aria-expanded={visibleUsers.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        value={query}
        onChange={(event) => handleQueryChange(event.target.value)}
        placeholder="Nombre o email"
      />

      {isSearching && !selected ? (
        <p className="mt-2 text-sm text-slate-500">Buscando…</p>
      ) : null}

      {!selected && !isSearching && visibleUsers.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">
          {isFiltering
            ? "No encontramos a nadie con eso."
            : "Todavía no hay usuarios registrados."}
        </p>
      ) : null}

      {visibleUsers.length > 0 ? (
        <ul
          className="mt-2 max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-white"
          id={listId}
          role="listbox"
        >
          {visibleUsers.map((user) => (
            <li key={user.id} role="option" aria-selected={selected?.id === user.id}>
              <button
                className="flex w-full flex-col items-start gap-1 px-4 py-3 text-left hover:bg-[#fffaf5]"
                type="button"
                onClick={() => selectUser(user)}
              >
                <span className="font-bold text-slate-800">{user.name}</span>
                <span className="text-sm text-slate-500">{user.email}</span>
                {user.alreadyAdmin ? (
                  <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#71ceff]">
                    Ya es admin
                  </span>
                ) : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {!selected && hasMore ? (
        <p className="mt-2 text-sm text-slate-500">
          Hay más de 20. Escribí para acotar.
        </p>
      ) : null}

      <button
        className="mt-6 w-full rounded-full bg-slate-800 px-5 py-3 font-bold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={!selected}
      >
        Asignar como admin
      </button>
    </form>
  );
}
