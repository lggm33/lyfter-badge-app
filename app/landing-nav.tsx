"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import type { MouseEvent } from "react";
import { LogoutButton } from "@/components/logout-button";

const outlineLinkClass =
  "rounded-full border border-slate-800 px-5 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-800 hover:text-white";

const primaryLinkClass =
  "rounded-full bg-slate-800 px-5 py-2 text-center text-sm font-bold text-white transition hover:bg-slate-700";

const menuLinkClass = "rounded-2xl px-4 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-100";

export function LandingNav({ signedIn }: { signedIn: boolean }) {
  const menuRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && menuRef.current?.open) {
        menuRef.current.open = false;
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, []);

  function closeMenu(event: MouseEvent<HTMLElement>) {
    const menu = event.currentTarget.closest("details");
    if (menu instanceof HTMLDetailsElement) {
      menu.open = false;
    }
  }

  return (
    <nav className="mx-auto w-full max-w-6xl px-5 py-4 sm:px-6 sm:py-6 lg:px-8">
      <div className="relative flex items-center justify-between gap-3 sm:hidden">
        <Logo />
        <details ref={menuRef} className="group">
          <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-full border border-slate-800 text-lg leading-none text-slate-800 [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden" aria-hidden="true">
              ☰
            </span>
            <span className="hidden group-open:inline" aria-hidden="true">
              ✕
            </span>
            <span className="sr-only">Menú</span>
          </summary>
          <div
            id="landing-menu"
            className="absolute inset-x-0 top-full z-20 mt-3 hidden flex-col gap-1 rounded-3xl border border-slate-200 bg-[#fffaf5] p-2 shadow-lg group-open:flex"
          >
            <a href="#como-funciona" className={menuLinkClass} onClick={closeMenu}>
              Cómo funciona
            </a>
            <AccountActions signedIn={signedIn} layout="stack" onNavigate={closeMenu} />
          </div>
        </details>
      </div>
      <div className="hidden items-center justify-between gap-3 sm:flex">
        <Logo />
        <div className="flex items-center gap-3">
          <a href="#como-funciona" className={outlineLinkClass}>
            Cómo funciona
          </a>
          <AccountActions signedIn={signedIn} layout="row" />
        </div>
      </div>
    </nav>
  );
}

function Logo() {
  return (
    <Link href="/" className="shrink-0 text-xl font-black tracking-tight text-slate-800">
      lyfter<span className="text-[#e88f95]">.</span>
    </Link>
  );
}

function AccountActions({
  signedIn,
  layout,
  onNavigate,
}: {
  signedIn: boolean;
  layout: "row" | "stack";
  onNavigate?: (event: MouseEvent<HTMLElement>) => void;
}) {
  const secondaryClass = layout === "row" ? outlineLinkClass : menuLinkClass;
  const actionClass = layout === "row" ? primaryLinkClass : `${primaryLinkClass} w-full`;

  if (signedIn) {
    return (
      <>
        <Link href="/home" className={actionClass} onClick={onNavigate}>
          Mi cuenta
        </Link>
        <LogoutButton className={layout === "stack" ? "w-full" : ""} />
      </>
    );
  }

  return (
    <>
      <Link href="/login" className={secondaryClass} onClick={onNavigate}>
        Iniciar sesión
      </Link>
      <Link href="/register" className={actionClass} onClick={onNavigate}>
        Registrarse
      </Link>
    </>
  );
}
