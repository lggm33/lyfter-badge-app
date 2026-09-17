"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavigationItems, type ShellContext } from "./navigation";

export function AppSidebar({ context, onNavigate }: { context: ShellContext; onNavigate?: () => void }) {
  const pathname = usePathname();
  return <nav aria-label="Navegación principal" className="flex h-full flex-col gap-2 bg-slate-900 p-4 text-white"><p className="mb-4 px-3 text-xs font-bold uppercase tracking-[0.2em] text-[#71ceff]">{context.kind === "company" ? context.companyName : "Lyfter"}</p>{getNavigationItems(context).map((item) => { const active = pathname === item.href || (item.href.includes("#") && pathname === item.href.split("#")[0]); return <Link aria-current={active ? "page" : undefined} className={`rounded-xl px-3 py-3 font-bold transition hover:bg-white/10 ${active ? "bg-white/15 text-[#71ceff]" : "text-slate-200"}`} href={item.href} key={item.href} onClick={onNavigate}>{item.label}</Link>; })}</nav>;
}
