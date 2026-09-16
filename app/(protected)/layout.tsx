import { requireSession } from "@/app/lib/authz";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireSession();

  return children;
}
