import { listMyCollection } from "@/app/(protected)/home/actions";
import { EventHistory } from "./event-history";

export default async function BadgesPage() {
  const history = await listMyCollection();

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col items-start gap-6">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#71ceff]">Tu historial</p>
      <h1 className="text-4xl font-black tracking-tight text-slate-800">{history.totalXp} XP</h1>
      <EventHistory events={history.events} />
    </div>
  );
}
