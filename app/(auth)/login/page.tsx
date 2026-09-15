import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <>
      <h1 className="text-2xl font-black text-slate-800">Iniciar sesión</h1>
      <p className="mt-2 text-sm text-slate-600">
        Entrá para ver tus badges y tu progreso.
      </p>
      <div className="mt-8">
        <LoginForm />
      </div>
      <p className="mt-6 text-sm text-slate-600">
        ¿No tenés cuenta?{" "}
        <Link href="/register" className="font-bold text-slate-800 underline">
          Registrate
        </Link>
      </p>
    </>
  );
}
