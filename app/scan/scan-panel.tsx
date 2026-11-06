"use client";

import { useEffect, useRef, useState } from "react";
import { scanMessage, type ScanResult } from "@/app/lib/scan-message";
import { submitScan } from "@/app/scan/actions";
import { retryWhileOffline, waitForOnline } from "@/app/scan/retry";
import { ScanCamera } from "@/app/scan/scan-camera";
import { ScanForm } from "@/app/scan/scan-form";

type SendState =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "retrying" }
  | { kind: "timeout" }
  | { kind: "failed" }
  | { kind: "done"; result: ScanResult };

export function ScanPanel() {
  const [state, setState] = useState<SendState>({ kind: "idle" });
  const abortRef = useRef<AbortController | null>(null);

  // Leaving the page stops the retries, so a late answer cannot redirect someone who moved on.
  useEffect(() => () => abortRef.current?.abort(), []);

  const busy = state.kind === "sending" || state.kind === "retrying";

  async function send(token: string) {
    if (busy) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ kind: "sending" });

    try {
      // A successful scan redirects inside the action; only a result that stays here comes back.
      const outcome = await retryWhileOffline(() => submitScan(token), {
        wait: () => waitForOnline(),
        onRetry: () => setState({ kind: "retrying" }),
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setState(outcome.ok ? { kind: "done", result: outcome.value } : { kind: "timeout" });
    } catch {
      if (!controller.signal.aborted) setState({ kind: "failed" });
    }
  }

  return (
    <>
      <SendNotice state={state} />
      <ScanCamera onToken={send} />
      <ScanForm busy={busy} onToken={send} />
    </>
  );
}

function SendNotice({ state }: { state: SendState }) {
  if (state.kind === "idle" || state.kind === "sending") return null;

  const notice =
    state.kind === "retrying"
      ? { tone: "wait", text: "Sin señal. Reintentando… lo seguimos intentando hasta 3 minutos." }
      : state.kind === "timeout"
        ? { tone: "error", text: "No pudimos enviar el escaneo. Volvé a escanear el código." }
        : state.kind === "failed"
          ? { tone: "error", text: "Algo salió mal. Volvé a escanear el código." }
          : { tone: state.result.ok ? "ok" : "error", text: scanMessage(state.result) };

  const toneClass =
    notice.tone === "ok"
      ? "border-[#add195] bg-[#add195]/30"
      : notice.tone === "wait"
        ? "border-amber-200 bg-amber-50"
        : "border-[#e88f95] bg-[#e88f95]/15";

  return (
    <p aria-live="polite" className={`mt-6 rounded-3xl border px-4 py-4 text-sm font-semibold text-slate-800 ${toneClass}`} role="status">
      {notice.text}
    </p>
  );
}
