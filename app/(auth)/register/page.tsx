import Link from "next/link";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <>
      <h1 className="text-2xl font-black text-slate-800">Crear cuenta</h1>
      <p className="mt-2 text-sm text-slate-600">
        Registrate para empezar a coleccionar badges.
      </p>
      <div className="mt-8">
        <RegisterForm />
      </div>
      <p className="mt-6 text-sm text-slate-600">
        ¿Ya tenés cuenta?{" "}
        <Link href="/login" className="font-bold text-slate-800 underline">
          Iniciá sesión
        </Link>
      </p>
    </>
  );
}
