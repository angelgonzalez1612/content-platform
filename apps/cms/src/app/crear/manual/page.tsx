import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CmsShell } from "@/components/cms/cms-shell";
import { PlaceCreateForm } from "@/components/cms/place-create-form";

export default async function CrearManualPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <CmsShell user={session} title="Crear manualmente">
      <div className="mx-auto max-w-[640px] p-[26px] pb-[60px]">
        <h1 className="mb-1 text-[22px] font-semibold tracking-tight">Nuevo lugar</h1>
        <p className="mb-5 text-[13.5px] text-ink-soft">Llena la ficha completa — se crea como borrador.</p>
        <PlaceCreateForm />
      </div>
    </CmsShell>
  );
}
