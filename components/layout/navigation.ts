export type ShellContext =
  | { kind: "participant" }
  | { kind: "company"; companyId: string; companyName: string }
  | { kind: "admin" };

export type NavigationItem = { label: string; href: string };

export function getNavigationItems(context: ShellContext): NavigationItem[] {
  if (context.kind === "company") {
    return [
      { label: "Inicio", href: `/company/${context.companyId}` },
      { label: "Eventos", href: `/company/${context.companyId}#eventos` },
      { label: "Auditoría", href: `/company/${context.companyId}/audit` },
    ];
  }
  if (context.kind === "admin") {
    return [
      { label: "Empresas", href: "/admin/companies" },
      { label: "Auditoría", href: "/admin/audit" },
    ];
  }
  return [
    { label: "Inicio", href: "/home" },
    { label: "Badges", href: "/badges" },
    { label: "Ranking", href: "/leaderboard" },
  ];
}
