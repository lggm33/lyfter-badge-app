import { notFound } from "next/navigation";
import { LogoutButton } from "@/components/logout-button";
import { getMyCompany } from "./actions";

export default async function CompanyHomePage({
  params,
}: {
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const company = await getMyCompany(companyId);

  if (!company) {
    notFound();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-start justify-center gap-6 px-6">
      <p className="inline-flex rounded-full bg-[#add195]/40 px-4 py-2 text-sm font-bold text-slate-700">
        Administrás esta empresa
      </p>
      <h1 className="text-4xl font-black tracking-tight text-slate-800">
        {company.name}
      </h1>
      <p className="text-lg text-slate-600">
        Todavía no hay eventos ni badges para administrar — esto es tu punto de
        partida.
      </p>
      <LogoutButton />
    </main>
  );
}
