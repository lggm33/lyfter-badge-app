import { requireSession } from "@/app/lib/authz";
import { listMyCompanies } from "./actions";
import { MyCompanies } from "./my-companies";

export default async function HomePage() {
  const session = await requireSession();
  const companies = await listMyCompanies();

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
      <MyCompanies companies={companies} />
    </main>
  );
}
