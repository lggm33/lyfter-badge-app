"use client";

import { useEffect, useState } from "react";
import { dateToCostaRicaInput } from "@/app/lib/costa-rica-time";

export function FutureDateTimeInput() {
  const [min, setMin] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setMin(dateToCostaRicaInput(new Date())), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return <input className="rounded-xl border border-slate-200 px-4 py-3 font-normal" type="datetime-local" name="startsAt" min={min || undefined} required />;
}
