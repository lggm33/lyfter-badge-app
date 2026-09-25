"use client";

import { useActionState } from "react";
import { scanMessage, type ScanResult } from "@/app/lib/scan-message";
import { submitScan } from "@/app/scan/actions";
import { Button } from "@/components/ui/button";
import { FormField } from "@/components/ui/form-field";

export function ScanForm({ initialResult }: { initialResult: ScanResult | null }) {
  const [result, action, pending] = useActionState(submitScan, initialResult);

  return (
    <form action={action} className="mt-6 flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5">
      <FormField id="token" name="token" label="Código o link" placeholder="Pegá el token o la URL" />
      {result && <CheckInNotice result={result} />}
      <Button type="submit" isLoading={pending}>
        Usar este código
      </Button>
    </form>
  );
}

function CheckInNotice({ result }: { result: ScanResult }) {
  const success = result.ok;
  return (
    <p
      className={`rounded-2xl px-4 py-3 text-sm font-semibold ${
        success ? "bg-[#add195]/40 text-slate-800" : "bg-[#e88f95]/20 text-slate-800"
      }`}
    >
      {scanMessage(result)}
    </p>
  );
}
