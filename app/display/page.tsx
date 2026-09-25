import { getPairedDisplay } from "@/app/display/actions";
import { qrNextRotation } from "@/app/lib/qr-token";
import { QrAutoRefresh } from "@/components/qr-auto-refresh";
import { QrCode } from "@/components/qr-code";

export const metadata = { title: "Pantalla QR · Lyfter" };

export default async function DisplayPage() {
  const display = await getPairedDisplay();

  return (
    <main className="grid min-h-screen place-items-center bg-slate-900 p-6 text-center text-white">
      {!display && (
        <div className="grid gap-3">
          <h1 className="text-2xl font-black">Esta pantalla no está emparejada</h1>
          <p className="text-slate-400">Pedile al administrador del evento un link de pantalla y abrilo en este dispositivo.</p>
        </div>
      )}
      {display?.status === "inactive" && (
        <div className="grid gap-3">
          <h1 className="text-2xl font-black">{display.eventName}</h1>
          <p className="text-slate-400">El QR aparece cuando el evento esté activo.</p>
          <p className="text-slate-400">Estado actual: {display.eventStatus}</p>
        </div>
      )}
      {display?.status === "active" && (
        <div className="grid gap-4">
          <p className="text-slate-400">{display.eventName}</p>
          <h1 className="text-3xl font-black tracking-tight">{display.title}</h1>
          <div className="mx-auto w-full max-w-md rounded-2xl bg-white p-4">
            <QrCode value={display.url} />
          </div>
          <p className="text-slate-400">Escaneá con la cámara de tu teléfono</p>
        </div>
      )}
      <QrAutoRefresh nextRotationAt={(display?.status === "active" ? display.nextRotationAt : qrNextRotation()).toISOString()} />
    </main>
  );
}
