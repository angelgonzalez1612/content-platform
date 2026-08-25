import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CmsShell } from "@/components/cms/cms-shell";
import { DashboardContent } from "@/components/cms/dashboard-content";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <CmsShell user={session} title="Dashboard">
      <DashboardContent user={session} />
    </CmsShell>
  );
}
