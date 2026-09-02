import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAutomationRules, getAutomationRuns, getAutomationStatus, getCmsCategories } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { AutomationView } from "./automation-view";

export default async function AutomatizacionesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [rules, runs, status, lamiraCategories, planazoCategories] = await Promise.all([
    getAutomationRules(),
    getAutomationRuns(),
    getAutomationStatus(),
    getCmsCategories("la-mira"),
    getCmsCategories("planazo"),
  ]);

  return (
    <CmsShell user={session} title="Automatizaciones">
      <AutomationView
        initialRules={rules}
        initialRuns={runs}
        initialStatus={status}
        lamiraCategories={lamiraCategories}
        planazoCategories={planazoCategories}
      />
    </CmsShell>
  );
}
