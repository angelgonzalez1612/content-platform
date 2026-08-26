import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCmsCategories } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { PlaceCreateForm } from "@/components/cms/place-create-form";
import { NoticiaForm } from "@/components/cms/lamira/noticia-form";
import { AlertaForm } from "@/components/cms/lamira/alerta-form";
import { GuiaForm } from "@/components/cms/lamira/guia-form";
import { LamiraEventoForm } from "@/components/cms/lamira/lamira-evento-form";
import { LamiraLugarForm } from "@/components/cms/lamira/lamira-lugar-form";
import { ReportajeForm } from "@/components/cms/lamira/reportaje-form";

const LAMIRA_TYPE_LABEL: Record<string, string> = {
  noticia: "Nueva noticia",
  alerta: "Nueva alerta",
  guia: "Nueva guía",
  evento: "Nuevo evento",
  lugar: "Nuevo lugar",
  reportaje: "Nuevo reportaje",
};

export default async function CrearManualPage({ searchParams }: { searchParams: Promise<{ site?: string; type?: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { site, type: rawType } = await searchParams;
  const isLamira = site === "lamira";
  const type = rawType && rawType in LAMIRA_TYPE_LABEL ? rawType : "noticia";

  if (isLamira) {
    const categories = await getCmsCategories("la-mira");
    return (
      <CmsShell user={session} title={LAMIRA_TYPE_LABEL[type]}>
        <div className="mx-auto max-w-[760px] p-[26px] pb-[60px]">
          <h1 className="mb-1 text-[22px] font-semibold tracking-tight">{LAMIRA_TYPE_LABEL[type]}</h1>
          <p className="mb-5 text-[13.5px] text-ink-soft">Llena la ficha completa — se crea como borrador salvo que cambies el estado.</p>
          {type === "noticia" && <NoticiaForm categories={categories} />}
          {type === "alerta" && <AlertaForm categories={categories} />}
          {type === "guia" && <GuiaForm categories={categories} />}
          {type === "evento" && <LamiraEventoForm categories={categories} />}
          {type === "lugar" && <LamiraLugarForm categories={categories} />}
          {type === "reportaje" && <ReportajeForm categories={categories} />}
        </div>
      </CmsShell>
    );
  }

  const categories = await getCmsCategories("planazo");

  return (
    <CmsShell user={session} title="Crear manualmente">
      <div className="mx-auto max-w-[640px] p-[26px] pb-[60px]">
        <h1 className="mb-1 text-[22px] font-semibold tracking-tight">Nuevo lugar</h1>
        <p className="mb-5 text-[13.5px] text-ink-soft">Llena la ficha completa — se crea como borrador.</p>
        <PlaceCreateForm categories={categories} />
      </div>
    </CmsShell>
  );
}
