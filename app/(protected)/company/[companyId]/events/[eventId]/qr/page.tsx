import Link from "next/link";
import { notFound } from "next/navigation";
import { QrAutoRefresh } from "@/components/qr-auto-refresh";
import { QrCode } from "@/components/qr-code";
import { CreateDisplayLinkForm } from "@/components/create-display-link-form";
import { getQrDisplay, listQrDisplays, revokeQrDisplay, type QrDisplayRow } from "../../../actions";

const displayStatusLabel: Record<QrDisplayRow["status"], string> = {
  pending: "Pendiente",
  paired: "Emparejada",
  revoked: "Revocada",
  expired: "Vencida",
};

export default async function EventQrPage({
  params,
  searchParams,
}: {
  params: Promise<{ companyId: string; eventId: string }>;
  searchParams: Promise<{ badge?: string | string[] }>;
}) {
  const { companyId, eventId } = await params;
  const { badge } = await searchParams;
  const badgeId = typeof badge === "string" ? badge : undefined;

  const display = await getQrDisplay(companyId, eventId, badgeId);

  if (!display) notFound();

  const displays = display.status === "active" ? await listQrDisplays(companyId, eventId, badgeId) : [];

  return <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
    <div className="grid w-full gap-4 rounded-2xl bg-white p-6 shadow-sm">
      {display.status === "active" ? <>
        <p className="text-sm text-slate-500">{display.eventName}</p>
        <h1 className="text-2xl font-black tracking-tight text-slate-800">{display.title}</h1>
        <QrCode value={display.url} className="mx-auto max-w-xs" />
        <p className="text-sm text-slate-500">Se actualiza cada 30 segundos</p>
        <QrAutoRefresh nextRotationAt={display.nextRotationAt.toISOString()} />
      </> : <>
        <p className="text-sm text-slate-500">{display.eventName}</p>
        <h1 className="text-xl font-black tracking-tight text-slate-800">El QR solo está disponible con el evento activo.</h1>
        <p className="text-sm text-slate-500">Estado actual: {display.eventStatus}</p>
      </>}
    </div>
    {display.status === "active" && <section className="grid w-full gap-4 rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="text-xl font-black text-slate-800">Pantallas del stand</h2>
      <CreateDisplayLinkForm companyId={companyId} eventId={eventId} badgeId={badgeId} />
      {displays.length === 0 ? <p className="text-sm text-slate-500">Todavía no hay pantallas.</p> : <ul className="grid gap-2 text-left">{displays.map((row) => <li className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 p-3" key={row.id}>
        <div><span className="font-bold text-slate-700">{displayStatusLabel[row.status]}</span><p className="text-sm text-slate-500">{row.createdAt.toLocaleString("es")}</p></div>
        {(row.status === "pending" || row.status === "paired") && <form action={revokeQrDisplay}><input type="hidden" name="companyId" value={companyId} /><input type="hidden" name="eventId" value={eventId} /><input type="hidden" name="displayId" value={row.id} />{badgeId && <input type="hidden" name="badge" value={badgeId} />}<button className="text-sm font-bold text-red-600" type="submit">Revocar</button></form>}
      </li>)}</ul>}
    </section>}
    <Link className="text-sm font-bold text-slate-700" href={`/company/${companyId}`}>← Volver al panel</Link>
  </main>;
}
