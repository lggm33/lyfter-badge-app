import { requireRole } from "@/app/lib/authz";
import { AppShell } from "@/components/layout/app-shell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("SUPER_ADMIN");
  return <AppShell context={{ kind: "admin" }} logoutTo="/admin/login" user={{ name: session.user.name, email: session.user.email }}>{children}</AppShell>;
}
