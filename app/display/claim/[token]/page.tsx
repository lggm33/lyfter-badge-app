import { ClaimDisplayForm } from "@/components/claim-display-form";

export default async function ClaimDisplayPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="grid min-h-screen place-items-center bg-slate-900 p-6 text-center text-white">
      <div className="grid gap-4">
        <h1 className="text-2xl font-black">Emparejar esta pantalla</h1>
        <p className="text-slate-400">Este dispositivo va a mostrar el QR del evento. El link funciona una sola vez.</p>
        <ClaimDisplayForm token={token} />
      </div>
    </main>
  );
}
