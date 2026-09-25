import Link from "next/link";
import { redirect } from "next/navigation";
import { scanToken } from "@/app/lib/scan";
import { destinationAfterScan, scanMessage } from "@/app/lib/scan-message";
import { accountChoiceLinks } from "@/app/lib/scan-next";
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
    return <AccountChoice token={token} />;
  }

  const result = token ? await scanToken(token, userId) : null;
  if (result) {
    const destination = destinationAfterScan(result);
    if (destination) redirect(destination);
  }

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
      <ScanForm initialResult={null} />
    </main>
  );
}

function AccountChoice({ token }: { token: string }) {
  const links = accountChoiceLinks(token);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-4 py-10">
      <h1 className="text-3xl font-black tracking-tight text-slate-800">¿Ya tenés cuenta?</h1>
      <p className="mt-2 text-sm text-slate-600">
        Entrá o creá una cuenta para completar el check-in. Después volvés acá.
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

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
