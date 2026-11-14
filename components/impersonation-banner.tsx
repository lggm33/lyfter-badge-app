import { stopImpersonation } from "@/app/lib/impersonation-actions";

export function ImpersonationBanner({ companyName }: { companyName: string }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[#71ceff]/30 px-4 py-3">
      <p className="font-bold text-slate-800">Estás administrando {companyName} como Super Admin.</p>
      <form action={stopImpersonation}>
        <button className="min-h-12 rounded-full bg-slate-800 px-4 py-2 text-sm font-bold text-white" type="submit">
          Volver al admin
        </button>
      </form>
    </div>
  );
}
