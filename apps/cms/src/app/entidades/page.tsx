import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CmsShell } from "@/components/cms/cms-shell";
import { EntidadesExplorer } from "@/components/cms/entidades/entidades-explorer";

export default async function EntidadesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <CmsShell user={session} title="Entidades">
      <EntidadesExplorer />
    </CmsShell>
  );
}
