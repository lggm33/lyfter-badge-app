import { requireRole } from "@/app/lib/authz";
import { listAuditCompanies, listAuditEvents, listPlatformAudit, parseAuditSearchParams } from "@/app/lib/audit";
import { AuditLog } from "@/components/audit-log";

type SearchParams = {
  company?: string | string[];
  event?: string | string[];
  actor?: string | string[];
  action?: string | string[];
  page?: string | string[];
};

export default async function AdminAuditPage({ searchParams }: { searchParams?: Promise<SearchParams> } = {}) {
  await requireRole("SUPER_ADMIN");
  const params = searchParams ? await searchParams : {};
  const query = parseAuditSearchParams(params);
  const result = await listPlatformAudit(query);
  const [companies, events] = await Promise.all([
    listAuditCompanies(),
    listAuditEvents(result.companyId),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#71ceff]">Super Admin</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-800">Auditoría</h1>
        <p className="mt-3 text-slate-600">Acciones de administración de toda la plataforma.</p>
      </div>
      <AuditLog actionPath="/admin/audit" companies={companies} events={events} result={result} />
    </div>
  );
}
