"use client";

import { useState } from "react";

export function ShareBadgeActions({ url, title, text }: { url: string; title: string; text: string }) {
  const [notice, setNotice] = useState<string | null>(null);
  const linkedIn = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
  const facebook = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setNotice("No se pudo compartir.");
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setNotice("Link copiado.");
    } catch {
      setNotice("No se pudo copiar el link.");
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button className="rounded-full border border-slate-200 bg-white px-5 py-3 font-bold text-slate-800" onClick={share} type="button">
        Compartir
      </button>
      <a className="rounded-full border border-slate-200 bg-white px-5 py-3 font-bold text-slate-800" href={linkedIn} rel="noopener noreferrer" target="_blank">
        LinkedIn
      </a>
      <a className="rounded-full border border-slate-200 bg-white px-5 py-3 font-bold text-slate-800" href={facebook} rel="noopener noreferrer" target="_blank">
        Facebook
      </a>
      <a className="rounded-full border border-slate-200 bg-white px-5 py-3 font-bold text-slate-800" download href={`${url}/opengraph-image`}>
        Descargar imagen
      </a>
      {notice && <p className="text-sm text-slate-500">{notice}</p>}
    </div>
  );
}
