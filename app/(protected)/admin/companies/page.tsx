import Link from "next/link";
import { createCompany, listCompanies } from "./actions";
import { LogoutButton } from "@/components/logout-button";

export default async function CompaniesPage() {
  const companies = await listCompanies();

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10 lg:px-8">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#71ceff]">
        Super Admin
      </p>
      <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-800">
        Empresas
      </h1>
      <p className="mt-3 text-slate-600">
        Creá las empresas que van a administrar sus propios eventos.
      </p>
      <LogoutButton redirectTo="/admin/login" />

      <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <form action={createCompany} className="rounded-3xl bg-white p-6 shadow-sm">
          <h2 className="text-xl font-black text-slate-800">Nueva empresa</h2>
          <label className="mt-6 block text-sm font-bold text-slate-700" htmlFor="name">
            Nombre
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
            id="name"
            name="name"
            required
            maxLength={120}
          />
          <label className="mt-5 block text-sm font-bold text-slate-700" htmlFor="slug">
            Slug
          </label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-3"
            id="slug"
            name="slug"
            pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            required
            maxLength={80}
            placeholder="mi-empresa"
          />
          <button
            className="mt-6 w-full rounded-full bg-slate-800 px-5 py-3 font-bold text-white hover:bg-slate-700"
            type="submit"
          >
            Crear empresa
          </button>
        </form>

        <section>
          <h2 className="text-xl font-black text-slate-800">Empresas registradas</h2>
          {companies.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-white p-6 text-slate-600">Todavía no hay empresas.</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {companies.map((item) => (
                <li className="rounded-2xl bg-white p-5 shadow-sm" key={item.id}>
                  <Link
                    className="font-bold text-slate-800 hover:text-[#71ceff]"
                    href={`/admin/companies/${item.id}`}
                  >
                    {item.name}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500">/{item.slug}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
