import Link from "next/link";
import { LoginForm } from "./login-form";
import { scanNextPath } from "@/app/lib/scan-next";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[]; disabled?: string | string[] }>;
}) {
  const params = await searchParams;
  const next = scanNextPath(firstParam(params.next));
  const disabled = firstParam(params.disabled) === "1";
  const registerHref = next === "/home" ? "/register" : `/register?next=${encodeURIComponent(next)}`;

  return (
    <>
      <h1 className="text-2xl font-black text-slate-800">Iniciar sesión</h1>
      <p className="mt-2 text-sm text-slate-600">
        Entrá para ver tus badges y tu progreso.
      </p>
      <div className="mt-8">
        <LoginForm disabled={disabled} redirectTo={next} />
      </div>
      <p className="mt-6 text-sm text-slate-600">
        ¿No tenés cuenta?{" "}
        <Link href={registerHref} className="font-bold text-slate-800 underline">
          Registrate
        </Link>
      </p>
    </>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}
