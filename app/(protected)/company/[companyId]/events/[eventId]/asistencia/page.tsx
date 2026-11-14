import Link from "next/link";
import { notFound } from "next/navigation";
import { getEventAttendance, parseAttendanceQuery, type AttendanceSearchParams } from "@/app/lib/attendance";
import { requireCompanyMembership } from "@/app/lib/authz";
import { EventAttendanceView } from "@/components/event-attendance";

export default async function EventAttendancePage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; eventId: string }>;
  searchParams?: Promise<AttendanceSearchParams>;
}) {
  const { companyId, eventId } = await params;
  await requireCompanyMembership(companyId);
  const attendance = await getEventAttendance(
    companyId,
    eventId,
    parseAttendanceQuery(searchParams ? await searchParams : {}),
  );
  if (!attendance) notFound();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#71ceff]">{attendance.eventName}</p>
        <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-800">Asistencia</h1>
        <p className="mt-3 text-slate-600">Quién llegó y quién canjeó cada badge.</p>
      </div>
      <EventAttendanceView attendance={attendance} basePath={`/company/${companyId}/events/${eventId}/asistencia`} />
      <Link className="text-sm font-bold text-slate-700" href={`/company/${companyId}#eventos`}>
        ← Volver a los eventos
      </Link>
    </div>
  );
}
