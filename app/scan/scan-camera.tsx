"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { IScannerControls } from "@zxing/browser";
import { extractScanToken } from "@/app/lib/scan-token";
import { Button } from "@/components/ui/button";

type CameraStatus = "idle" | "starting" | "live" | "blocked";

export function ScanCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scanningRef = useRef(false);
  const router = useRouter();
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      controlsRef.current?.stop();
    };
  }, []);

  async function startCamera() {
    const video = videoRef.current;
    if (!video || scanningRef.current) return;

    scanningRef.current = true;
    setMessage(null);
    setStatus("starting");

    if (!navigator.mediaDevices?.getUserMedia) {
      failCamera("Este navegador no puede abrir la cámara. Pegá el código abajo.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } },
      });
    } catch (error) {
      failCamera(cameraErrorMessage(error));
      return;
    }

    try {
      const controls = await readQrFromStream(video, stream, (token) => {
        controlsRef.current?.stop();
        controlsRef.current = null;
        router.push(`/scan?t=${encodeURIComponent(token)}`);
      });
      controlsRef.current = controls;
      setStatus("live");
    } catch (error) {
      stopStream(stream);
      failCamera(cameraErrorMessage(error));
    }
  }

  function failCamera(nextMessage: string) {
    controlsRef.current?.stop();
    controlsRef.current = null;
    scanningRef.current = false;
    setStatus("blocked");
    setMessage(nextMessage);
  }

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    scanningRef.current = false;
    setStatus("idle");
  }

  const showVideo = status === "starting" || status === "live";

  return (
    <section className="mt-6 flex flex-col gap-3">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label="Vista de la cámara"
        className={
          showVideo
            ? "aspect-square w-full rounded-3xl bg-slate-900 object-cover"
            : "sr-only"
        }
      />
      {message && (
        <p className="rounded-3xl border border-[#e88f95] bg-[#e88f95]/15 px-4 py-4 text-sm font-semibold text-slate-800">
          {message}
        </p>
      )}
      {status === "live" ? (
        <Button type="button" variant="secondary" onClick={stopCamera}>
          Cerrar cámara
        </Button>
      ) : (
        <Button type="button" variant="secondary" isLoading={status === "starting"} onClick={startCamera}>
          Usar la cámara
        </Button>
      )}
    </section>
  );
}

async function readQrFromStream(
  video: HTMLVideoElement,
  stream: MediaStream,
  onToken: (token: string) => void,
) {
  const { BrowserQRCodeReader } = await import("@zxing/browser");
  const reader = new BrowserQRCodeReader();
  let finished = false;

  return reader.decodeFromStream(stream, video, (result, _error, controls) => {
    if (finished || !result) return;
    const token = extractScanToken(result.getText());
    if (!token) return;
    finished = true;
    controls.stop();
    onToken(token);
  });
}

function stopStream(stream: MediaStream) {
  for (const track of stream.getTracks()) {
    track.stop();
  }
}

function cameraErrorMessage(error: unknown) {
  if (!(error instanceof DOMException)) {
    return "No pudimos abrir la cámara. Pegá el código abajo.";
  }
  if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
    return "No pudimos usar la cámara. Pegá el código abajo.";
  }
  if (error.name === "NotFoundError") {
    return "No encontramos una cámara. Pegá el código abajo.";
  }
  return "No pudimos abrir la cámara. Pegá el código abajo.";
}
