import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCmsPlaces, getCmsEvents, getCmsPlanazoGuide } from "@/lib/cms-api";
import { buildPlaceOptions } from "@/lib/guide-place-options";
import { CmsShell } from "@/components/cms/cms-shell";
import { GuideForm } from "@/components/cms/planazo/guide-form";
import { VersionHistory } from "@/components/cms/version-history";
import { ViewPublishedLinks } from "@/components/cms/view-published-link";
import { EditPageHeader } from "@/components/cms/edit-page-header";
import { ReviewBar } from "@/components/cms/review-bar";
import { RevisorNavBar } from "@/components/cms/revisor-nav-bar";
import { getReviewQueue, isReviewSite } from "@/lib/review-queue";

export default async function EditPlanazoGuidePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string; desde?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const { revision, desde } = await searchParams;
  const reviewQueue = isReviewSite(revision) ? await getReviewQueue(revision) : null;
  const [guide, places, events] = await Promise.all([getCmsPlanazoGuide(id), getCmsPlaces(), getCmsEvents()]);
  if (!guide) notFound();

  return (
    <CmsShell user={session} title={guide.title}>
      <EditPageHeader
        kicker="Guía · Planazo"
        title={guide.title}
        actions={<ViewPublishedLinks site="planazo" path={`guias/${guide.slug}`} available={guide.status === "published"} />}
        review={
          reviewQueue && isReviewSite(revision) ? (
            <ReviewBar site={revision} queue={reviewQueue} currentHref={`/contenido/planazo-guia/${id}`} />
          ) : desde === "revisor" ? (
            <RevisorNavBar currentHref={`/contenido/planazo-guia/${id}`} />
          ) : undefined
        }
      />

      <div className="flex flex-col gap-4 p-[26px] pt-5 pb-[60px]">
        <VersionHistory contentType="planazo-guia" contentId={guide.id} />
        <GuideForm placeOptions={buildPlaceOptions(places, events)} existing={guide} />
      </div>
    </CmsShell>
  );
}
