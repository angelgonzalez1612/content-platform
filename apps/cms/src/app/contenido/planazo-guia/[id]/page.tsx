import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCmsPlaces, getCmsEvents, getCmsPlanazoGuide } from "@/lib/cms-api";
import { buildPlaceOptions } from "@/lib/guide-place-options";
import { CmsShell } from "@/components/cms/cms-shell";
import { GuideForm } from "@/components/cms/planazo/guide-form";
import { ViewPublishedLink } from "@/components/cms/view-published-link";
import { siteConfig } from "@planazo/config";

export default async function EditPlanazoGuidePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const [guide, places, events] = await Promise.all([getCmsPlanazoGuide(id), getCmsPlaces(), getCmsEvents()]);
  if (!guide) notFound();

  return (
    <CmsShell user={session} title={guide.title}>
      <div className="sticky top-0 z-10 border-b border-border-soft bg-background px-[26px] pt-[26px] pb-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">Guía · Planazo</p>
          <ViewPublishedLink href={`${siteConfig.planazoUrl}/guias/${guide.slug}`} available={guide.status === "published"} />
        </div>
        <h1 className="mt-3 text-[22px] font-semibold tracking-tight">{guide.title}</h1>
      </div>

      <div className="p-[26px] pb-[60px]">
        <GuideForm placeOptions={buildPlaceOptions(places, events)} existing={guide} />
      </div>
    </CmsShell>
  );
}
