import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadShareCard, shareCardDetail, shareCardText } from "@/app/lib/share-badge";

export async function generateMetadata({ params }: { params: Promise<{ redemptionId: string }> }): Promise<Metadata> {
  const card = await loadShareCard((await params).redemptionId);
  if (!card) return { title: "Badge" };
  const title = shareCardText(card);
  return { title, description: card.eventName, openGraph: { title, description: card.eventName } };
}

export default async function ShareBadgePage({ params }: { params: Promise<{ redemptionId: string }> }) {
  const { redemptionId } = await params;
  const card = await loadShareCard(redemptionId);
  if (!card) notFound();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center gap-4 px-6">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#71ceff]">Lyfter</p>
      <article className="grid gap-2 rounded-3xl border border-slate-200 bg-white p-6">
        {card.icon && <p className="text-4xl">{card.icon}</p>}
        <h1 className="text-4xl font-black tracking-tight text-slate-800">{card.name}</h1>
        <p className="text-lg text-slate-600">{shareCardDetail(card)}</p>
        <p className="text-sm text-slate-500">{card.eventName}</p>
      </article>
      <Link className="w-fit rounded-full border border-slate-200 px-5 py-3 font-bold text-slate-800" href="/">
        Conocé Lyfter
      </Link>
    </main>
  );
}
