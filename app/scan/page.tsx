import { redirect } from "next/navigation";
import { scanToken } from "@/app/lib/scan";
import { scanMessage } from "@/app/lib/scan-message";
import { loginPathForScan } from "@/app/lib/scan-next";
import { currentUserId } from "@/app/scan/actions";
import { ScanForm } from "@/app/scan/scan-form";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[] }>;
}) {
  const token = firstParam((await searchParams).t);
  const userId = token ? await currentUserId() : null;

  if (token && !userId) {
    redirect(loginPathForScan(token));
  }

  const result = token ? await scanToken(token, userId) : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight text-slate-800">Escanear</h1>
      <p className="mt-2 text-sm text-slate-600">
        Escaneá el QR de la entrada o de un badge, o pegá el código.
      </p>
      {result?.ok && (
        <p className="mt-6 rounded-3xl border border-[#add195] bg-[#add195]/30 px-4 py-4 text-sm font-semibold text-slate-800">
          {scanMessage(result)}
        </p>
      )}
      {result && !result.ok && (
        <p className="mt-6 rounded-3xl border border-[#e88f95] bg-[#e88f95]/15 px-4 py-4 text-sm font-semibold text-slate-800">
          {scanMessage(result)}
        </p>
      )}
      <ScanForm initialResult={null} />
    </main>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
