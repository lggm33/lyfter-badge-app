import Link from "next/link";
import { RegisterForm } from "./register-form";
import { scanNextPath } from "@/app/lib/scan-next";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = scanNextPath(firstParam((await searchParams).next));
  const loginHref = next === "/home" ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <>
      <h1 className="text-2xl font-black text-slate-800">Crear cuenta</h1>
      <p className="mt-2 text-sm text-slate-600">
        Registrate para empezar a coleccionar badges.
      </p>
      <div className="mt-8">
        <RegisterForm redirectTo={next} />
      </div>
      <p className="mt-6 text-sm text-slate-600">
        ¿Ya tenés cuenta?{" "}
        <Link href={loginHref} className="font-bold text-slate-800 underline">
          Iniciá sesión
        </Link>
      </p>
    </>
  );
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}
