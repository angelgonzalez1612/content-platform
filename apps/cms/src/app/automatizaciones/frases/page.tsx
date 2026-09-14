import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAutomationRules, getAutomationRuns, getAutomationStatus } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { PhrasesView } from "./phrases-view";

export default async function AutomationPhrasesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [rules, runs, status] = await Promise.all([getAutomationRules(), getAutomationRuns(), getAutomationStatus()]);

  return (
    <CmsShell user={session} title="Frases de búsqueda">
      <PhrasesView initialRules={rules} initialRuns={runs} initialStatus={status} />
    </CmsShell>
  );
}
