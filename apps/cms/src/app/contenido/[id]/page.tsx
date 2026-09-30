import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCmsPlace, getCmsCategory, getCmsCategories } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { PlaceEditForm } from "@/components/cms/place-edit-form";
import { VersionHistory } from "@/components/cms/version-history";
import { ViewPublishedLinks } from "@/components/cms/view-published-link";
import { EditPageHeader } from "@/components/cms/edit-page-header";
import { ReviewBar } from "@/components/cms/review-bar";
import { getReviewQueue, isReviewSite } from "@/lib/review-queue";
import { MoveToLamiraButton } from "@/components/cms/move-to-lamira";

export default async function EditPlacePage({
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
  const place = await getCmsPlace(id);
  if (!place) notFound();

  const categoryId = place.categories[0]?.id;
  const category = categoryId ? await getCmsCategory(categoryId) : null;
  const lamiraCategories = await getCmsCategories("la-mira");

  return (
    <CmsShell user={session} title={place.name}>
      {/* Fija arriba mientras se scrollea el formulario largo de abajo — el
          contenedor con scroll es el `overflow-y-auto` de CmsShell, así que
          `sticky top-0` en un hijo directo (sin otro overflow entre medio)
          se pega ahí solo. */}
      <EditPageHeader
        kicker="Lugar · Planazo"
        title={place.name}
        subtitle={`/${place.slug}`}
        review={reviewQueue && isReviewSite(revision) ? <ReviewBar site={revision} queue={reviewQueue} currentHref={`/contenido/${id}`} /> : undefined}
        actions={
          <span className="flex flex-wrap items-center gap-1.5">
            <MoveToLamiraButton
              sourceType="place"
              sourceId={place.id}
              title={place.name}
              categories={lamiraCategories}
              defaultCategoryId={matchLamiraCategory(lamiraCategories, place.categories[0]?.slug, place.categories[0]?.name)}
            />
            <ViewPublishedLinks site="planazo" path={`lugares/${place.slug}`} available={place.status === "published"} />
          </span>
        }
      />

      <div className="flex flex-col gap-4 p-[26px] pt-5 pb-[60px]">
        <VersionHistory contentType="place" contentId={place.id} />
        <PlaceEditForm place={place} category={category} />
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
