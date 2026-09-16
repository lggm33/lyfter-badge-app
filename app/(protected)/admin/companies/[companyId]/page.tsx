import Link from "next/link";
import { notFound } from "next/navigation";
import { getCompany, listCompanyMembers, removeCompanyMember } from "../actions";
import { AssignCompanyAdminForm } from "./assign-admin-form";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await getCompany(companyId);

  if (!company) {
    notFound();
  }

  const members = await listCompanyMembers(companyId);

  return (
    <main className="mx-auto min-h-screen w-full max-w-5xl px-6 py-10 lg:px-8">
      <Link className="text-sm font-bold text-[#71ceff]" href="/admin/companies">
        ← Volver a empresas
      </Link>
      <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-800">
        {company.name}
      </h1>
      <p className="mt-1 text-slate-500">/{company.slug}</p>

      <section className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <AssignCompanyAdminForm companyId={companyId} />

        <section>
          <h2 className="text-xl font-black text-slate-800">Administradores</h2>
          {members.length === 0 ? (
            <p className="mt-4 rounded-2xl bg-white p-6 text-slate-600">
              Todavía no hay administradores asignados.
            </p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {members.map((member) => (
                <li
                  className="flex items-center justify-between gap-4 rounded-2xl bg-white p-5 shadow-sm"
                  key={member.id}
                >
                  <div>
                    <p className="font-bold text-slate-800">{member.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{member.email}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.15em] text-[#71ceff]">
                      {member.role}
                    </p>
                  </div>
                  <form action={removeCompanyMember}>
                    <input type="hidden" name="companyId" value={companyId} />
                    <input type="hidden" name="memberId" value={member.id} />
                    <button
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:border-[#e88f95] hover:text-[#e88f95]"
                      type="submit"
                    >
                      Quitar
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </section>
      </section>
    </main>
  );
}
