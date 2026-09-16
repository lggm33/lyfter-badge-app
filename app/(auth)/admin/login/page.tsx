import Link from "next/link";
import { AdminLoginForm } from "./admin-login-form";

export default function AdminLoginPage() {
  return (
    <>
      <h1 className="text-2xl font-black text-slate-800">Acceso administrativo</h1>
      <div className="mt-8"><AdminLoginForm /></div>
      <p className="mt-6 text-sm text-slate-600">
        ¿Sos participante? <Link href="/login" className="font-bold text-slate-800 underline">Iniciá sesión acá</Link>
      </p>
    </>
  );
}
