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
    ];
  }
  if (context.kind === "admin") return [{ label: "Empresas", href: "/admin/companies" }];
  return [{ label: "Inicio", href: "/home" }];
}
