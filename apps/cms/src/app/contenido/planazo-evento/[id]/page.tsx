import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCmsCategories, getCmsEvent } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { PlanazoEventForm } from "@/components/cms/planazo/planazo-event-form";

export default async function EditPlanazoEventPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const [event, categories] = await Promise.all([getCmsEvent(id), getCmsCategories("planazo")]);
  if (!event) notFound();

  return (
    <CmsShell user={session} title={event.name}>
      <div className="mx-auto max-w-[760px] p-[26px] pb-[60px]">
        <p className="mb-1 font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">Evento · Planazo</p>
        <h1 className="mb-5 text-[22px] font-semibold tracking-tight">{event.name}</h1>
        <PlanazoEventForm categories={categories} existing={event} />
      </div>
    </CmsShell>
  );
}
