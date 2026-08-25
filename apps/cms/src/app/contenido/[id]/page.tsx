import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSession } from "@/lib/auth";
import { getCmsPlace } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { PlaceEditForm } from "@/components/cms/place-edit-form";

export default async function EditPlacePage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const place = await getCmsPlace(id);
  if (!place) notFound();

  return (
    <CmsShell user={session} title={place.name}>
      <div className="mx-auto max-w-[720px] p-[26px] pb-[60px]">
        <Link href="/contenido" className="text-[12.5px] text-ink-soft hover:text-brand">
          ← Contenido
        </Link>
        <h1 className="mt-3 mb-1 text-[22px] font-semibold tracking-tight">{place.name}</h1>
        <p className="mb-6 text-[13.5px] text-ink-soft">/{place.slug}</p>

        <PlaceEditForm place={place} />
      </div>
    </CmsShell>
  );
}
