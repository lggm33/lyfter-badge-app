export const EVENT_STATUS = {
  DRAFT: { icon: "📝", label: "Borrador", className: "bg-amber-100 text-amber-800" },
  ACTIVE: { icon: "🟢", label: "Activo", className: "bg-emerald-100 text-emerald-800" },
  FINISHED: { icon: "🏁", label: "Finalizado", className: "bg-slate-100 text-slate-600" },
} as const;

export function EventStatusBadge({ status }: { status: string }) {
  const style = EVENT_STATUS[status as keyof typeof EVENT_STATUS];
  if (!style) return <span className="text-sm text-slate-500">{status}</span>;

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold ${style.className}`}>
      <span aria-hidden="true">{style.icon}</span>
      {style.label}
    </span>
  );
}
