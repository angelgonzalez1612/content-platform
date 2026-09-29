import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCmsPlace, getCmsCategory } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { PlaceEditForm } from "@/components/cms/place-edit-form";
import { VersionHistory } from "@/components/cms/version-history";
import { ViewPublishedLinks } from "@/components/cms/view-published-link";
import { EditPageHeader } from "@/components/cms/edit-page-header";

export default async function EditPlacePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const place = await getCmsPlace(id);
  if (!place) notFound();

  const categoryId = place.categories[0]?.id;
  const category = categoryId ? await getCmsCategory(categoryId) : null;

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
        actions={<ViewPublishedLinks site="planazo" path={`lugares/${place.slug}`} available={place.status === "published"} />}
      />

      <div className="flex flex-col gap-4 p-[26px] pt-5 pb-[60px]">
        <VersionHistory contentType="place" contentId={place.id} />
        <PlaceEditForm place={place} category={category} />
      </div>
    </CmsShell>
  );
}
