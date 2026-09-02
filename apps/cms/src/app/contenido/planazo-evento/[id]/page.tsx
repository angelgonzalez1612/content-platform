import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCmsCategories, getCmsEvent } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { PlanazoEventForm } from "@/components/cms/planazo/planazo-event-form";
import { ViewPublishedLink } from "@/components/cms/view-published-link";
import { siteConfig } from "@planazo/config";

export default async function EditPlanazoEventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const [event, categories] = await Promise.all([getCmsEvent(id), getCmsCategories("planazo")]);
  if (!event) notFound();

  return (
    <CmsShell user={session} title={event.name}>
      <div className="sticky top-0 z-10 border-b border-border-soft bg-background px-[26px] pt-[26px] pb-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">Evento · Planazo</p>
          <ViewPublishedLink href={`${siteConfig.planazoUrl}/eventos/${event.slug}`} available={event.status === "published"} />
        </div>
        <h1 className="mt-3 text-[22px] font-semibold tracking-tight">{event.name}</h1>
      </div>

      <div className="p-[26px] pb-[60px]">
        <PlanazoEventForm categories={categories} existing={event} />
      </div>
    </CmsShell>
  );
}
