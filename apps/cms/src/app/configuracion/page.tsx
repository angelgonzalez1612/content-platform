import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getAiSettingsStatus } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { ConfiguracionView } from "./configuracion-view";

export default async function ConfiguracionPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const aiSettings = await getAiSettingsStatus();

  return (
    <CmsShell user={session} title="Configuración">
      <ConfiguracionView initialAiSettings={aiSettings} />
    </CmsShell>
  );
}
