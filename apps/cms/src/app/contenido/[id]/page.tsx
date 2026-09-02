import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getCmsPlace, getCmsCategory } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { PlaceEditForm } from "@/components/cms/place-edit-form";
import { ViewPublishedLink } from "@/components/cms/view-published-link";
import { siteConfig } from "@planazo/config";

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
      <div className="sticky top-0 z-10 border-b border-border-soft bg-background px-[26px] pt-[26px] pb-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/contenido" className="text-[12.5px] text-ink-soft hover:text-brand">
            ← Contenido
          </Link>
          <ViewPublishedLink href={`${siteConfig.planazoUrl}/lugares/${place.slug}`} available={place.status === "published"} />
        </div>
        <h1 className="mt-3 mb-1 text-[22px] font-semibold tracking-tight">{place.name}</h1>
        <p className="text-[13.5px] text-ink-soft">/{place.slug}</p>
      </div>

      <div className="p-[26px] pb-[60px]">
        <PlaceEditForm place={place} category={category} />
      </div>
    </CmsShell>
  );
}
