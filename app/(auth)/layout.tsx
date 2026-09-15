import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md rounded-4xl border border-slate-200 bg-white p-8 shadow-sm">
        <Link
          href="/"
          className="mb-8 inline-block text-xl font-black tracking-tight text-slate-800"
        >
          lyfter<span className="text-[#e88f95]">.</span>
        </Link>
        {children}
      </div>
    </main>
  );
}
