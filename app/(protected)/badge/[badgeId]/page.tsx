import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyBadge } from "@/app/(protected)/home/actions";

export default async function BadgePage({
  params,
}: {
  params: Promise<{ badgeId: string }>;
}) {
  const { badgeId } = await params;
  const earned = await getMyBadge(badgeId);
  if (!earned) redirect("/home");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-start justify-center gap-6 px-6">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#71ceff]">Badge</p>
      <h1 className="text-4xl font-black tracking-tight text-slate-800">¡Felicidades!</h1>
      <p className="text-lg text-slate-600">
        Obtuviste el badge {earned.icon ? `${earned.icon} ` : ""}
        {earned.name} y {earned.xp} XP.
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
