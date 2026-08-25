import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CmsShell } from "@/components/cms/cms-shell";
import { GeneratePlaceFlow } from "@/components/cms/generate-place-flow";

export default async function CentroIaPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <CmsShell user={session} title="Centro IA">
      <GeneratePlaceFlow />
    </CmsShell>
  );
}
