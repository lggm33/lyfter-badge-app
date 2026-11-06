"use client";

import { useEffect, useState } from "react";

function localDateTime() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

export function FutureDateTimeInput() {
  const [min, setMin] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setMin(localDateTime()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return <input className="rounded-xl border border-slate-200 px-4 py-3 font-normal" type="datetime-local" name="startsAt" min={min || undefined} required />;
}
