import { requireSession } from "@/app/lib/authz";
import { AppShell } from "@/components/layout/app-shell";

export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  return <AppShell context={{ kind: "participant" }} logoutTo="/" user={{ name: session.user.name, email: session.user.email }}>{children}</AppShell>;
}
