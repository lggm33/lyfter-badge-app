import { renderQrSvg } from "@/app/lib/qr-display";

export async function QrCode({ value, className }: { value: string; className?: string }) {
  const svg = await renderQrSvg(value);
  return (
    <div
      className={`aspect-square w-full [&>svg]:h-full [&>svg]:w-full ${className ?? ""}`}
      // Safe: SVG generated server-side by the qrcode package from our own URL, not user input.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
