import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CmsShell } from "@/components/cms/cms-shell";
import { AdsensePlanView } from "./adsense-plan-view";

export default async function CaminoAdsensePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <CmsShell user={session} title="Camino a AdSense">
      <AdsensePlanView />
    </CmsShell>
  );
}
