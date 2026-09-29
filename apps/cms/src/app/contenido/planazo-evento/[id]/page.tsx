import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCmsCategories, getCmsEvent } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { PlanazoEventForm } from "@/components/cms/planazo/planazo-event-form";
import { VersionHistory } from "@/components/cms/version-history";
import { ViewPublishedLinks } from "@/components/cms/view-published-link";
import { EditPageHeader } from "@/components/cms/edit-page-header";

export default async function EditPlanazoEventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const [event, categories] = await Promise.all([getCmsEvent(id), getCmsCategories("planazo")]);
  if (!event) notFound();

  return (
    <CmsShell user={session} title={event.name}>
      <EditPageHeader
        kicker="Evento · Planazo"
        title={event.name}
        actions={<ViewPublishedLinks site="planazo" path={`eventos/${event.slug}`} available={event.status === "published"} />}
      />

      <div className="flex flex-col gap-4 p-[26px] pt-5 pb-[60px]">
        <VersionHistory contentType="evento-planazo" contentId={event.id} />
        <PlanazoEventForm categories={categories} existing={event} />
      </div>
    </CmsShell>
  );
}
