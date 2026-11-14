import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { listAuditEvents, listCompanyAudit, parseAuditSearchParams } from "@/app/lib/audit";
import { requireCompanyMembership } from "@/app/lib/authz";
import { AuditLog } from "@/components/audit-log";
import { db } from "@/db";
import { company } from "@/db/schema";

type SearchParams = {
  event?: string | string[];
  actor?: string | string[];
  action?: string | string[];
  page?: string | string[];
};

export default async function CompanyAuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const { companyId } = await params;
  await requireCompanyMembership(companyId);
  const [current] = await db.select({ id: company.id, name: company.name }).from(company).where(eq(company.id, companyId));
  if (!current) notFound();

  const query = parseAuditSearchParams(searchParams ? await searchParams : {});
  const [result, events] = await Promise.all([
    listCompanyAudit(companyId, query),
    listAuditEvents(companyId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#71ceff]">{current.name}</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-800">Auditoría</h1>
        <p className="mt-3 text-slate-600">Acciones de administración de esta empresa.</p>
      </div>
      <AuditLog actionPath={`/company/${companyId}/audit`} companies={null} events={events} result={result} />
    </div>
  );
}
