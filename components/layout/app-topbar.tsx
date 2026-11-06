"use client";

import Link from "next/link";
import { LogoutButton } from "@/components/logout-button";

export function AppTopbar({ name, email, logoutTo, onMenu }: { name: string; email: string; logoutTo: string; onMenu: () => void }) {
  return <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6 lg:h-16 lg:py-0"><div className="flex items-center gap-3"><button aria-label="Abrir navegación" className="rounded-xl border border-slate-200 px-3 py-2 text-xl leading-none lg:hidden" onClick={onMenu} type="button">☰</button><Link className="font-black tracking-tight text-slate-800 hover:text-slate-600" href="/home">Lyfter Badge App</Link></div><div className="flex items-center gap-3"><div className="hidden text-right sm:block"><p className="text-sm font-bold text-slate-800">{name}</p><p className="text-xs text-slate-500">{email}</p></div><LogoutButton redirectTo={logoutTo} /></div></header>;
}
