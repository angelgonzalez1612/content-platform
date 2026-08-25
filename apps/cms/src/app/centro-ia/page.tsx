import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCmsCategories } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { GeneratePlaceFlow } from "@/components/cms/generate-place-flow";

export default async function CentroIaPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const categories = await getCmsCategories("planazo");

  return (
    <CmsShell user={session} title="Centro IA">
      <GeneratePlaceFlow categories={categories} />
    </CmsShell>
  );
}
