import Link from "next/link";

type CollectedBadge = {
  redemptionId: string;
  badgeId: string;
  name: string;
  icon: string | null;
  eventName: string;
  xp: number;
  redeemedAt: Date;
};

export function MyCollection({
  totalXp,
  badges,
}: {
  totalXp: number;
  badges: CollectedBadge[];
}) {
  return (
    <section className="flex w-full flex-col items-start gap-3">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#71ceff]">Tu colección</p>
      <p className="text-3xl font-black tracking-tight text-slate-800">{totalXp} XP</p>
      {badges.length === 0 ? (
        <p className="text-slate-600">Todavía no canjeaste badges.</p>
      ) : (
        <ul className="grid w-full gap-3 sm:grid-cols-2">
          {badges.map((item) => (
            <li key={item.redemptionId}>
              <Link className="block rounded-3xl border border-slate-200 bg-white p-4" href={`/badge/${item.badgeId}`}>
                <p className="font-black text-slate-800">
                  {item.icon ? `${item.icon} ` : ""}
                  {item.name}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {item.eventName} · {item.xp} XP
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}