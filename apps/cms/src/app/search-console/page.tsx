import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CmsShell } from "@/components/cms/cms-shell";
import { SearchConsoleView } from "./search-console-view";

export default async function SearchConsolePage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <CmsShell user={session} title="Search Console">
      <SearchConsoleView />
    </CmsShell>
  );
}
