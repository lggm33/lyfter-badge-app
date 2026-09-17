import { requireCompanyMembership } from "@/app/lib/authz";
import { AppShell } from "@/components/layout/app-shell";
import { getMyCompany } from "./actions";

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  const session = await requireCompanyMembership(companyId);
  const company = await getMyCompany(companyId);

  return <AppShell context={{ kind: "company", companyId, companyName: company?.name ?? "Empresa" }} logoutTo="/" user={{ name: session.user.name, email: session.user.email }}>{children}</AppShell>;
}
