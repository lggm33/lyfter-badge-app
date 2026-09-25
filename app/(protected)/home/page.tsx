import { requireSession } from "@/app/lib/authz";
import { listMyCollection, listMyCompanies } from "./actions";
import { MyCollection } from "./my-collection";
import { MyCompanies } from "./my-companies";

export default async function HomePage({
  searchParams,
}: {
  searchParams?: Promise<{ notice?: string | string[]; name?: string | string[]; xp?: string | string[] }>;
} = {}) {
  const session = await requireSession();
  const companies = await listMyCompanies();
  const collection = await listMyCollection();
  const notice = welcomeNotice(searchParams ? await searchParams : {});

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-start gap-6 px-6 py-16">
      <p className="inline-flex rounded-full bg-[#add195]/40 px-4 py-2 text-sm font-bold text-slate-700">
        Sesión activa
      </p>
      <h1 className="text-4xl font-black tracking-tight text-slate-800">
        Hola, {session.user.name} 👋
      </h1>
      {notice && (
        <p className="rounded-3xl border border-[#add195] bg-[#add195]/30 px-4 py-4 text-sm font-semibold text-slate-800">
          {notice}
        </p>
      )}
      <p className="text-lg text-slate-600">
        Tus badges y tu XP están acá. El total sale de los movimientos del ledger.
      </p>
      <MyCollection badges={collection.badges} totalXp={collection.totalXp} />
      <MyCompanies companies={companies} />
    </main>
  );
}

function welcomeNotice(params: {
  notice?: string | string[];
  name?: string | string[];
  xp?: string | string[];
}) {
  const notice = firstValue(params.notice);
  const name = firstValue(params.name);
  if (!name) return null;
  if (notice === "checkin") return `Listo. Ya estás en ${name}.`;
  if (notice === "badge") return `Listo. Sumaste ${firstValue(params.xp) || "0"} XP por ${name}.`;
  return null;
}

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
