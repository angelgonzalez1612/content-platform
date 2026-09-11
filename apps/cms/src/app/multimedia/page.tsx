import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getMediaLibrary } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { MediaView } from "./media-view";

export default async function MultimediaPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const items = await getMediaLibrary();

  return (
    <CmsShell user={session} title="Biblioteca Multimedia">
      <MediaView initialItems={items} />
    </CmsShell>
  );
}
