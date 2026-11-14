import { requireRole } from "@/app/lib/authz";
import { getMetrics, parseMetricsQuery } from "@/app/lib/metrics";
import { MetricsDashboard } from "@/components/metrics-dashboard";

type SearchParams = {
  event?: string | string[];
  type?: string | string[];
};

export default async function AdminMetricsPage({ searchParams }: { searchParams?: Promise<SearchParams> } = {}) {
  await requireRole("SUPER_ADMIN");
  const query = parseMetricsQuery(searchParams ? await searchParams : {});
  const snapshot = await getMetrics({ kind: "platform" }, query);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#71ceff]">Super Admin</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-800">Inicio</h1>
        <p className="mt-3 text-slate-600">Check-ins, canjes y horario de afluencia de la plataforma.</p>
      </div>
      <MetricsDashboard actionPath="/admin" attendanceCompanyId={null} snapshot={snapshot} />
    </div>
  );
}
