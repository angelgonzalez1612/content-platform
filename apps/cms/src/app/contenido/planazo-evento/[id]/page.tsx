import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCmsCategories, getCmsEvent } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { PlanazoEventForm } from "@/components/cms/planazo/planazo-event-form";
import { VersionHistory } from "@/components/cms/version-history";
import { ViewPublishedLinks } from "@/components/cms/view-published-link";
import { EditPageHeader } from "@/components/cms/edit-page-header";
import { ReviewBar } from "@/components/cms/review-bar";
import { getReviewQueue, isReviewSite } from "@/lib/review-queue";
import { MoveToLamiraButton } from "@/components/cms/move-to-lamira";

export default async function EditPlanazoEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ revision?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const { revision } = await searchParams;
  const reviewQueue = isReviewSite(revision) ? await getReviewQueue(revision) : null;
  const [event, categories, lamiraCategories] = await Promise.all([getCmsEvent(id), getCmsCategories("planazo"), getCmsCategories("la-mira")]);
  if (!event) notFound();

  return (
    <CmsShell user={session} title={event.name}>
      <EditPageHeader
        kicker="Evento · Planazo"
        title={event.name}
        actions={
          <span className="flex flex-wrap items-center gap-1.5">
            <MoveToLamiraButton
              sourceType="evento-planazo"
              sourceId={event.id}
              title={event.name}
              categories={lamiraCategories}
              defaultCategoryId={matchLamiraCategory(
                lamiraCategories,
                categories.find((c) => c.id === event.categoryId)?.slug,
                categories.find((c) => c.id === event.categoryId)?.name,
              )}
            />
            <ViewPublishedLinks site="planazo" path={`eventos/${event.slug}`} available={event.status === "published"} />
          </span>
        }
        review={reviewQueue && isReviewSite(revision) ? <ReviewBar site={revision} queue={reviewQueue} currentHref={`/contenido/planazo-evento/${id}`} /> : undefined}
      />

      <div className="flex flex-col gap-4 p-[26px] pt-5 pb-[60px]">
        <VersionHistory contentType="evento-planazo" contentId={event.id} />
        <PlanazoEventForm categories={categories} existing={event} />
      </div>
    </CmsShell>
  );
}

// Categoría de La Mira equivalente (mismo slug o mismo nombre), para dejarla
// preseleccionada en "Mover a La Mira".
function matchLamiraCategory(lamira: { id: string; slug: string; name: string }[], slug?: string | null, name?: string | null): string | null {
  const norm = (t?: string | null) => (t ?? "").trim().toLowerCase();
  return lamira.find((c) => (slug && c.slug === slug) || (name && norm(c.name) === norm(name)))?.id ?? null;
}
