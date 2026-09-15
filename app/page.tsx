import Link from "next/link";
import { headers } from "next/headers";
import { auth } from "@/app/lib/auth";
import { LogoutButton } from "@/components/logout-button";

const highlights = [
  ["01", "Escaneá", "Registrá tu llegada y descubrí cada experiencia del evento."],
  ["02", "Coleccioná", "Obtené badges y XP por cada charla o stand que visites."],
  ["03", "Subí de nivel", "Completá tu colección, competí en el leaderboard y ganá premios."],
];

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  return (
    <main className="min-h-screen overflow-hidden">
      <nav className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6 lg:px-8">
        <Link href="/" className="text-xl font-black tracking-tight text-slate-800">
          lyfter<span className="text-[#e88f95]">.</span>
        </Link>
        <div className="flex items-center gap-3">
          <a href="#como-funciona" className="rounded-full border border-slate-800 px-5 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-800 hover:text-white">
            Cómo funciona
          </a>
          {session ? (
            <>
              <Link href="/home" className="rounded-full bg-slate-800 px-5 py-2 text-sm font-bold text-white transition hover:bg-slate-700">
                Mi cuenta
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="rounded-full border border-slate-800 px-5 py-2 text-sm font-bold text-slate-800 transition hover:bg-slate-800 hover:text-white">
                Iniciar sesión
              </Link>
              <Link href="/register" className="rounded-full bg-slate-800 px-5 py-2 text-sm font-bold text-white transition hover:bg-slate-700">
                Registrarse
              </Link>
            </>
          )}
        </div>
      </nav>
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-6 pb-20 pt-12 lg:grid-cols-[1.1fr_.9fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-20">
        <div>
          <p className="mb-6 inline-flex rounded-full bg-[#add195]/40 px-4 py-2 text-sm font-bold text-slate-700">
            Tu evento. Tu experiencia. Tus logros.
          </p>
          <h1 className="max-w-3xl text-5xl font-black leading-[0.95] tracking-tight text-slate-800 sm:text-7xl">
            Convertí cada evento en una historia que puedas{" "}
            <span className="text-[#e88f95]">coleccionar.</span>
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-slate-600">
            Escaneá, descubrí y conectá. Lyfter Badge App transforma tu recorrido por cada evento en badges, XP y recompensas.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <a href="#como-funciona" className="rounded-full bg-slate-800 px-7 py-4 text-center font-bold text-white transition hover:bg-slate-700">
              Empezar a explorar
            </a>
            <a href="#beneficios" className="rounded-full bg-[#71ceff] px-7 py-4 text-center font-bold text-slate-800 transition hover:bg-[#add195]">
              Soy organizador
            </a>
          </div>
        </div>
        <div className="relative mx-auto flex aspect-square w-full max-w-md items-center justify-center rounded-[3rem] bg-[#ffcc8b] p-8 sm:p-12">
          <div className="absolute -right-3 top-8 rounded-2xl bg-[#d798e7] px-4 py-3 text-sm font-black text-slate-800 shadow-lg sm:-right-8">+250 XP</div>
          <div className="absolute -bottom-4 -left-3 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-700 shadow-lg sm:-left-8">Badge desbloqueado ✦</div>
          <div className="flex aspect-square w-full max-w-64 rotate-3 items-center justify-center rounded-[2.5rem] border-8 border-white bg-[#add195] shadow-2xl">
            <div className="flex h-36 w-36 items-center justify-center rounded-full border-4 border-dashed border-slate-800 text-6xl">✦</div>
          </div>
        </div>
      </section>
      <section id="como-funciona" className="bg-slate-800 px-6 py-20 text-white lg:px-8">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#71ceff]">Así de simple</p>
          <h2 className="mt-4 max-w-xl text-4xl font-black tracking-tight sm:text-5xl">Tu recorrido también cuenta.</h2>
          <div id="beneficios" className="mt-12 grid gap-8 md:grid-cols-3">
            {highlights.map(([number, title, description]) => (
              <article key={number} className="border-t border-white/20 pt-5">
                <span className="text-sm font-black text-[#e88f95]">{number}</span>
                <h3 className="mt-8 text-2xl font-black">{title}</h3>
                <p className="mt-3 leading-7 text-slate-300">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <footer className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <span className="font-bold text-slate-800">lyfter.</span>
        <span>La comunidad empieza con una experiencia.</span>
      </footer>
    </main>
  );
}
