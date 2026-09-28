import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAiSettingsStatus, getAutomationRules } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { ConfiguracionView } from "./configuracion-view";

export default async function ConfiguracionPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [aiSettings, rules] = await Promise.all([getAiSettingsStatus(), getAutomationRules()]);
  // Para decir cuántas reglas se afectan al cambiar el predeterminado.
  const rulesUsingDefault = rules.filter((r) => r.active && r.provider === "default").length;

  return (
    <CmsShell user={session} title="Configuración">
      <ConfiguracionView initialAiSettings={aiSettings} rulesUsingDefault={rulesUsingDefault} />
    </CmsShell>
  );
}
