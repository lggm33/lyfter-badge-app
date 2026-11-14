import Form from "next/form";
import Link from "next/link";
import { requireRole } from "@/app/lib/authz";
import { directoryRoleLabel, listUserDirectory, parseDirectoryQuery } from "@/app/lib/user-directory";

type SearchParams = {
  q?: string | string[];
  page?: string | string[];
};

export default async function AdminUsersPage({ searchParams }: { searchParams?: Promise<SearchParams> } = {}) {
  await requireRole("SUPER_ADMIN");
  const query = parseDirectoryQuery(searchParams ? await searchParams : {});
  const result = await listUserDirectory(query);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#71ceff]">Super Admin</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-800">Usuarios</h1>
        <p className="mt-3 text-slate-600">Directorio de solo lectura. Desde acá no se edita ni se borra a nadie.</p>
      </div>

      <Form action="/admin/users" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-2 text-sm font-bold text-slate-700">
          Buscar
          <input
            className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal text-slate-800"
            defaultValue={result.search}
            name="q"
            placeholder="Nombre o email"
            type="search"
          />
        </label>
        <button className="min-h-12 rounded-full bg-slate-800 px-6 py-3 text-sm font-bold text-white" type="submit">
          Buscar
        </button>
      </Form>

      {result.searchTooShort && (
        <p className="text-sm text-slate-600">Escribí al menos 2 caracteres para buscar.</p>
      )}

      {result.rows.length === 0 ? (
        <p className="rounded-3xl bg-white p-6 text-slate-600">
          {result.page > 1 ? "No hay más usuarios." : "No hay usuarios para esa búsqueda."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {result.rows.map((person) => (
            <li className="rounded-3xl bg-white p-4 shadow-sm" key={person.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-black text-slate-800">{person.name}</p>
                <time className="text-sm text-slate-500" dateTime={person.createdAt.toISOString()}>
                  {person.createdAt.toLocaleDateString("es")}
                </time>
              </div>
              <p className="mt-1 text-sm text-slate-600">{person.email}</p>
              <p className="mt-2 text-sm text-slate-500">
                {directoryRoleLabel(person.role)}
                {" · "}
                {person.companies || "Sin empresas"}
              </p>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap gap-3">
        {result.page > 1 && <PageLink href={directoryHref(result.search, result.page - 1)} label="Anterior" />}
        {result.hasNextPage && <PageLink href={directoryHref(result.search, result.page + 1)} label="Siguiente" />}
      </div>
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

function directoryHref(search: string, page: number) {
  const query = new URLSearchParams();
  if (search) query.set("q", search);
  if (page > 1) query.set("page", String(page));
  const value = query.toString();
  return value ? `/admin/users?${value}` : "/admin/users";
}
