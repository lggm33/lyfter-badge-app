"use client";

import { useState } from "react";

export function ShareBadgeActions({ url, title, text }: { url: string; title: string; text: string }) {
  const [notice, setNotice] = useState<string | null>(null);

  async function share() {
    if (typeof navigator.share === "function") {
      await navigator.share({ title, text, url });
      return;
    }
    await navigator.clipboard.writeText(url);
    setNotice("Link copiado.");
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button className="rounded-full border border-slate-200 bg-white px-5 py-3 font-bold text-slate-800" onClick={share} type="button">
        Compartir
      </button>
      <a className="rounded-full border border-slate-200 bg-white px-5 py-3 font-bold text-slate-800" download href={`${url}/opengraph-image`}>
        Descargar imagen
      </a>
      {notice && <p className="text-sm text-slate-500">{notice}</p>}
    </div>
  );
}
