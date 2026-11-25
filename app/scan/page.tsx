import Link from "next/link";
import { redirect } from "next/navigation";
import { scanToken } from "@/app/lib/scan";
import { accountChoiceLinks } from "@/app/lib/scan-next";
import { hasScanHold } from "@/app/lib/scan-hold";
import { destinationAfterScan, scanMessage, type ScanResult } from "@/app/lib/scan-message";
import { isUserDisabled } from "@/app/lib/user-status";
import { currentUserId } from "@/app/scan/actions";
import { ScanPanel } from "@/app/scan/scan-panel";

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string | string[]; error?: string | string[]; hold?: string | string[]; flow?: string | string[] }>;
}) {
  const params = await searchParams;
  const token = firstParam(params.t);
  const error = firstParam(params.error);
  const held = firstParam(params.hold);
  const userId = await currentUserId();

  if (userId && (await isUserDisabled(userId))) {
    redirect("/logout-disabled");
  }

  if (token && !userId) {
    redirect(`/scan/capture?t=${encodeURIComponent(token)}`);
  }

  if (token && userId) {
    const result = await scanToken(token, userId);
    const destination = destinationAfterScan(result);
    if (destination) redirect(destination);
    return <ScanScreen result={result} />;
  }

  if (userId && !held && (await hasScanHold())) {
    redirect("/scan/complete");
  }

  if (!userId && !error && (await hasScanHold())) {
    return <AccountChoice />;
  }

  return <ScanScreen result={tokenError(error) ?? heldResult(held, firstParam(params.flow))} />;
}

function ScanScreen({ result }: { result: ScanResult | null }) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight text-slate-800">Escanear</h1>
      <p className="mt-2 text-sm text-slate-600">
        Escaneá el QR de la entrada o de un badge, o pegá el código.
      </p>
      {result && !result.ok && (
        <p className="mt-6 rounded-3xl border border-[#e88f95] bg-[#e88f95]/15 px-4 py-4 text-sm font-semibold text-slate-800">
          {scanMessage(result)}
        </p>
      )}
      <ScanPanel />
    </main>
  );
}

function AccountChoice() {
  const links = accountChoiceLinks();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight text-slate-800">¿Ya tenés cuenta?</h1>
      <p className="mt-2 text-sm text-slate-600">
        Entrá o creá una cuenta para completar el escaneo. Queda guardado en este navegador por 15 minutos.
      </p>
      <div className="mt-8 flex flex-col gap-3">
        <Link
          className="rounded-full bg-slate-800 px-7 py-3 text-center font-bold text-white"
          href={links.login}
        >
          Iniciar sesión
        </Link>
        <Link
          className="rounded-full bg-[#71ceff] px-7 py-3 text-center font-bold text-slate-800"
          href={links.register}
        >
          Crear cuenta
        </Link>
      </div>
    </main>
  );
}

function tokenError(error: string): ScanResult | null {
  if (error === "expired" || error === "invalid") {
    return { flow: "checkin", ok: false, reason: error };
  }
  return null;
}

function heldResult(reason: string, flow: string): ScanResult | null {
  if (reason !== "event_not_started" && reason !== "event_closed" && reason !== "disabled" && reason !== "invalid" && reason !== "expired") {
    return null;
  }
  if (flow === "redeem") return { flow: "redeem", ok: false, reason };
  return { flow: "checkin", ok: false, reason };
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
