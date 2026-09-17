"use client";

import { useEffect, useState } from "react";
import { AppSidebar } from "./app-sidebar";
import { AppTopbar } from "./app-topbar";
import type { ShellContext } from "./navigation";

export function AppShell({ children, context, user, logoutTo }: { children: React.ReactNode; context: ShellContext; user: { name: string; email: string }; logoutTo: string }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  useEffect(() => {
    if (!sidebarOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setSidebarOpen(false);
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [sidebarOpen]);
  return <div className="min-h-screen bg-slate-50 text-slate-800"><AppTopbar email={user.email} name={user.name} onMenu={() => setSidebarOpen(true)} logoutTo={logoutTo} /><div className="lg:grid lg:min-h-[calc(100vh-4rem)] lg:grid-cols-[15rem_1fr]"><aside className="hidden lg:block"><AppSidebar context={context} /></aside>{sidebarOpen && <div aria-hidden="true" className="fixed inset-0 z-40 bg-slate-900/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}<aside aria-label="Menú móvil" className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform lg:hidden ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}><AppSidebar context={context} onNavigate={() => setSidebarOpen(false)} /></aside><main className="min-w-0 p-4 sm:p-6 lg:p-8">{children}</main></div></div>;
}
