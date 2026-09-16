import { requireCompanyMembership } from "@/app/lib/authz";

export default async function CompanyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ companyId: string }>;
}) {
  const { companyId } = await params;
  await requireCompanyMembership(companyId);

  return children;
}
