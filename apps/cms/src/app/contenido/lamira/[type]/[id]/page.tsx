import { notFound, redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  getCmsCategories,
  getCmsNoticia,
  getCmsAlerta,
  getCmsGuia,
  getCmsLamiraEvento,
  getCmsLamiraLugar,
  getCmsReportaje,
} from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { NoticiaForm } from "@/components/cms/lamira/noticia-form";
import { AlertaForm } from "@/components/cms/lamira/alerta-form";
import { GuiaForm } from "@/components/cms/lamira/guia-form";
import { LamiraEventoForm } from "@/components/cms/lamira/lamira-evento-form";
import { LamiraLugarForm } from "@/components/cms/lamira/lamira-lugar-form";
import { ReportajeForm } from "@/components/cms/lamira/reportaje-form";

const TYPE_LABEL: Record<string, string> = {
  noticia: "Noticia",
  alerta: "Alerta",
  guia: "Guía",
  evento: "Evento",
  lugar: "Lugar",
  reportaje: "Reportaje",
};

export default async function EditLamiraContentPage({ params }: { params: Promise<{ type: string; id: string }> }) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { type, id } = await params;
  const categories = await getCmsCategories("la-mira");

  let title: string;
  let form: React.ReactNode;

  switch (type) {
    case "noticia": {
      const item = await getCmsNoticia(id);
      if (!item) notFound();
      title = item.title;
      form = <NoticiaForm categories={categories} existing={item} />;
      break;
    }
    case "alerta": {
      const item = await getCmsAlerta(id);
      if (!item) notFound();
      title = item.title;
      form = <AlertaForm categories={categories} existing={item} />;
      break;
    }
    case "guia": {
      const item = await getCmsGuia(id);
      if (!item) notFound();
      title = item.title;
      form = <GuiaForm categories={categories} existing={item} />;
      break;
    }
    case "evento": {
      const item = await getCmsLamiraEvento(id);
      if (!item) notFound();
      title = item.title;
      form = <LamiraEventoForm categories={categories} existing={item} />;
      break;
    }
    case "lugar": {
      const item = await getCmsLamiraLugar(id);
      if (!item) notFound();
      title = item.name;
      form = <LamiraLugarForm categories={categories} existing={item} />;
      break;
    }
    case "reportaje": {
      const item = await getCmsReportaje(id);
      if (!item) notFound();
      title = item.title;
      form = <ReportajeForm categories={categories} existing={item} />;
      break;
    }
    default:
      notFound();
  }

  return (
    <CmsShell user={session} title={title}>
      <div className="mx-auto max-w-[760px] p-[26px] pb-[60px]">
        <p className="mb-1 font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">{TYPE_LABEL[type]} · La Mira</p>
        <h1 className="mb-5 text-[22px] font-semibold tracking-tight">{title}</h1>
        {form}
      </div>
    </CmsShell>
  );
}
