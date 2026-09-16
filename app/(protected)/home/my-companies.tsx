import Link from "next/link";

type CompanyLink = {
  id: string;
  name: string;
};

export function MyCompanies({ companies }: { companies: CompanyLink[] }) {
  if (companies.length === 0) {
    return null;
  }

  const heading = companies.length === 1 ? "Tu empresa" : "Mis empresas";

  return (
    <section className="flex w-full flex-col items-start gap-3">
      <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#71ceff]">
        {heading}
      </p>
      <div className="flex w-full flex-col gap-3 sm:max-w-md">
        {companies.map((item) => (
          <Link
            className="rounded-full bg-slate-800 px-7 py-3 text-center font-bold text-white transition hover:bg-slate-700"
            href={`/company/${item.id}`}
            key={item.id}
          >
            {item.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
