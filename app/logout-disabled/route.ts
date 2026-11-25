import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/app/lib/auth";

/** Signs out a disabled account. The protected layout cannot write cookies itself. */
export async function GET() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/login?disabled=1");
}
