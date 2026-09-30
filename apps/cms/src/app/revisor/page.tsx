import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getReviewAgentQueue } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { ReviewerView } from "./reviewer-view";

export default async function RevisorPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  const queue = await getReviewAgentQueue();

  return (
    <CmsShell user={session} title="Revisor">
      <ReviewerView initialQueue={queue} />
    </CmsShell>
  );
}
