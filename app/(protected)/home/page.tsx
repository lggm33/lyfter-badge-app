import { headers } from "next/headers";
import { auth } from "@/app/lib/auth";
import { LogoutButton } from "@/components/logout-button";

export default async function HomePage() {
  // ponytail: (protected)/layout.tsx ya redirige si no hay sesión;
  // esta lectura es solo para mostrar el nombre del usuario.
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) {
    return null;
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-start justify-center gap-6 px-6">
      <p className="inline-flex rounded-full bg-[#add195]/40 px-4 py-2 text-sm font-bold text-slate-700">
        Sesión activa
      </p>
      <h1 className="text-4xl font-black tracking-tight text-slate-800">
        Hola, {session.user.name} 👋
      </h1>
      <p className="text-lg text-slate-600">
        Todavía no hay eventos ni badges cargados — esto es tu punto de
        partida.
      </p>
      <LogoutButton />
    </main>
  );
}
