import { requireSession } from "@/app/lib/authz";
import { listMyCollection, listMyCompanies } from "./actions";
import { MyCollection } from "./my-collection";
import { MyCompanies } from "./my-companies";

export default async function HomePage() {
  const session = await requireSession();
  const companies = await listMyCompanies();
  const collection = await listMyCollection();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-start gap-6 px-6 py-16">
      <p className="inline-flex rounded-full bg-[#add195]/40 px-4 py-2 text-sm font-bold text-slate-700">
        Sesión activa
      </p>
      <h1 className="text-4xl font-black tracking-tight text-slate-800">
        Hola, {session.user.name} 👋
      </h1>
      <p className="text-lg text-slate-600">
        Tus badges y tu XP están acá. El total sale de los movimientos del ledger.
      </p>
      <MyCollection badges={collection.badges} totalXp={collection.totalXp} />
      <MyCompanies companies={companies} />
    </main>
  );
}
