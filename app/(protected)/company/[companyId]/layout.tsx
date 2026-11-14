import { isImpersonatingCompany, requireCompanyMembership } from "@/app/lib/authz";
import { ImpersonationBanner } from "@/components/impersonation-banner";
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
  const impersonating = await isImpersonatingCompany(session.user.id, companyId);
  const companyName = company?.name ?? "Empresa";

  return (
    <AppShell context={{ kind: "company", companyId, companyName }} logoutTo="/" user={{ name: session.user.name, email: session.user.email }}>
      {impersonating && <ImpersonationBanner companyName={companyName} />}
      {children}
    </AppShell>
  );
}
