import type { ReactNode } from "react";
import Form from "next/form";
import Link from "next/link";
import {
  AUDIT_ACTIONS,
  auditActionLabel,
  describeAuditMetadata,
  type AuditListResult,
} from "@/app/lib/audit";

type CompanyOption = { id: string; name: string };
type EventOption = { id: string; name: string; companyName: string };

export function AuditLog({
  actionPath,
  companies,
  events,
  result,
}: {
  actionPath: string;
  companies: CompanyOption[] | null;
  events: EventOption[];
  result: AuditListResult;
}) {
  return (
    <div className="flex w-full flex-col gap-6">
      <Form action={actionPath} className="grid w-full gap-3 sm:grid-cols-2">
        {companies && (
          <FilterField label="Empresa" name="company" value={result.companyId ?? ""}>
            <option value="">Todas</option>
            {companies.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </FilterField>
        )}
        <FilterField label="Evento" name="event" value={result.eventId ?? ""}>
          <option value="">Todos</option>
          {events.map((item) => (
            <option key={item.id} value={item.id}>
              {companies ? `${item.companyName} · ${item.name}` : item.name}
            </option>
          ))}
        </FilterField>
        <FilterField label="Acción" name="action" value={result.action ?? ""}>
          <option value="">Todas</option>
          {AUDIT_ACTIONS.map((action) => (
            <option key={action} value={action}>{auditActionLabel(action)}</option>
          ))}
        </FilterField>
        <label className="flex flex-col gap-2 text-sm font-bold text-slate-700">
          Persona
          <input
            className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal text-slate-800"
            defaultValue={result.actorQuery}
            name="actor"
            placeholder="Nombre o email"
            type="search"
          />
        </label>
        <button className="min-h-12 rounded-full bg-slate-800 px-6 py-3 text-sm font-bold text-white sm:col-span-2 sm:justify-self-start" type="submit">
          Filtrar
        </button>
      </Form>

      {result.actorTooShort && (
        <p className="text-sm text-slate-600">Escribí al menos 2 caracteres para filtrar por persona.</p>
      )}

      {result.rows.length === 0 ? (
        <p className="rounded-3xl bg-white p-6 text-slate-600">
          {result.page > 1 ? "No hay más acciones." : "Todavía no hay acciones registradas."}
        </p>
      ) : (
        <ol className="flex w-full flex-col gap-3">
          {result.rows.map((row) => (
            <li className="rounded-3xl bg-white p-4 shadow-sm" key={row.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-black text-slate-800">{auditActionLabel(row.action)}</p>
                <time className="text-sm text-slate-500" dateTime={row.createdAt.toISOString()}>
                  {row.createdAt.toLocaleString("es")}
                </time>
              </div>
              <p className="mt-1 text-sm text-slate-600">{auditDetails(row)}</p>
            </li>
          ))}
        </ol>
      )}

      {(result.page > 1 || result.hasNextPage) && (
        <nav aria-label="Páginas" className="flex w-full justify-between gap-3">
          {result.page > 1 ? <PageLink href={auditHref(actionPath, result, result.page - 1)} label="← Anterior" /> : <span />}
          {result.hasNextPage && <PageLink href={auditHref(actionPath, result, result.page + 1)} label="Siguiente →" />}
        </nav>
      )}
    </div>
  );
}

function FilterField({
  label,
  name,
  value,
  children,
}: {
  label: string;
  name: string;
  value?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-sm font-bold text-slate-700">
      {label}
      <select className="min-h-12 rounded-xl border border-slate-200 bg-white px-3 py-3 font-normal text-slate-800" defaultValue={value ?? ""} name={name}>
        {children}
      </select>
    </label>
  );
}

function PageLink({ href, label }: { href: string; label: string }) {
  return (
    <Link className="min-h-12 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700" href={href}>
      {label}
    </Link>
  );
}

function auditDetails(row: AuditListResult["rows"][number]) {
  const metadata = describeAuditMetadata(row.metadata);
  const parts = [row.actorName, row.companyName, row.eventName, metadata].filter((part): part is string => Boolean(part));
  return parts.join(" · ");
}

function auditHref(actionPath: string, result: AuditListResult, page: number) {
  const query = new URLSearchParams();
  if (result.companyId && actionPath === "/admin/audit") query.set("company", result.companyId);
  if (result.eventId) query.set("event", result.eventId);
  if (result.action) query.set("action", result.action);
  if (result.actorQuery) query.set("actor", result.actorQuery);
  if (page > 1) query.set("page", String(page));
  const search = query.toString();
  return search ? `${actionPath}?${search}` : actionPath;
}
