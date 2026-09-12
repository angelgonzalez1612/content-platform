import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getMediaLibrary, getMediaAssets, getCmsCategories } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { MediaView } from "./media-view";

export default async function MultimediaPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [items, assets, categories] = await Promise.all([getMediaLibrary(), getMediaAssets(), getCmsCategories()]);

  return (
    <CmsShell user={session} title="Biblioteca Multimedia">
      <MediaView initialItems={items} initialAssets={assets} categories={categories} />
    </CmsShell>
  );
}
