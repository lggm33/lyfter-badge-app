import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyBadge } from "@/app/(protected)/home/actions";

export default async function BadgePage({
  params,
  searchParams,
}: {
  params: Promise<{ badgeId: string }>;
  searchParams?: Promise<{ fresh?: string | string[] }>;
}) {
  const { badgeId } = await params;
  const earned = await getMyBadge(badgeId);
  if (!earned) redirect("/home");

  const fresh = firstValue(searchParams ? (await searchParams).fresh : undefined) === "1";
  const label = `${earned.icon ? `${earned.icon} ` : ""}${earned.name}`;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-start justify-center gap-6 px-6">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#71ceff]">Badge</p>
      <h1 className="text-4xl font-black tracking-tight text-slate-800">
        {fresh ? "¡Felicidades!" : "Ya lo obtuviste"}
      </h1>
      <p className="text-lg text-slate-600">
        {fresh
          ? `Obtuviste el badge ${label} y ${earned.xp} XP.`
          : `Ya tenías el badge ${label} y sus ${earned.xp} XP.`}
      </p>
      <p className="text-sm text-slate-500">{earned.eventName}</p>
      <Link
        className="rounded-full bg-slate-800 px-7 py-3 text-center font-bold text-white"
        href="/home"
      >
        Ir al inicio
      </Link>
    </main>
  );
}

function firstValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] ?? "";
  return value ?? "";
}
