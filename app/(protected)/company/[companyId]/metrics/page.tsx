import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { requireCompanyMembership } from "@/app/lib/authz";
import { getMetrics, parseMetricsQuery } from "@/app/lib/metrics";
import { MetricsDashboard } from "@/components/metrics-dashboard";
import { db } from "@/db";
import { company } from "@/db/schema";

type SearchParams = {
  event?: string | string[];
  type?: string | string[];
};

export default async function CompanyMetricsPage({
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

  const query = parseMetricsQuery(searchParams ? await searchParams : {});
  const snapshot = await getMetrics({ kind: "company", companyId }, query);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#71ceff]">{current.name}</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-800">Métricas</h1>
        <p className="mt-3 text-slate-600">Check-ins, canjes y horario de afluencia de esta empresa.</p>
      </div>
      <MetricsDashboard actionPath={`/company/${companyId}/metrics`} attendanceCompanyId={companyId} snapshot={snapshot} />
    </div>
  );
}
