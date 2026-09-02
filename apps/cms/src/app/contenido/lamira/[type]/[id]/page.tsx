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
import { ViewPublishedLink } from "@/components/cms/view-published-link";
import { LAMIRA_TYPE_PATH } from "@/lib/lamira-paths";
import { siteConfig } from "@planazo/config";

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
  let slug: string;
  // alerta/evento/lugar no tienen borrador — cualquier fila creada ya es
  // pública de inmediato (ver AiDraftService). noticia/guia/reportaje solo
  // son visibles en el sitio real cuando status === "published" (filtro real
  // del backend público, ver NoticiasService.findBySlug y equivalentes) — el
  // link de "Ver publicación" no debe ofrecerse si todavía llevaría a un 404.
  let isPublished: boolean;

  switch (type) {
    case "noticia": {
      const item = await getCmsNoticia(id);
      if (!item) notFound();
      title = item.title;
      slug = item.slug;
      isPublished = item.status === "published";
      form = <NoticiaForm categories={categories} existing={item} />;
      break;
    }
    case "alerta": {
      const item = await getCmsAlerta(id);
      if (!item) notFound();
      title = item.title;
      slug = item.slug;
      isPublished = true;
      form = <AlertaForm categories={categories} existing={item} />;
      break;
    }
    case "guia": {
      const item = await getCmsGuia(id);
      if (!item) notFound();
      title = item.title;
      slug = item.slug;
      isPublished = item.status === "published";
      form = <GuiaForm categories={categories} existing={item} />;
      break;
    }
    case "evento": {
      const item = await getCmsLamiraEvento(id);
      if (!item) notFound();
      title = item.title;
      slug = item.slug;
      isPublished = true;
      form = <LamiraEventoForm categories={categories} existing={item} />;
      break;
    }
    case "lugar": {
      const item = await getCmsLamiraLugar(id);
      if (!item) notFound();
      title = item.name;
      slug = item.slug;
      isPublished = true;
      form = <LamiraLugarForm categories={categories} existing={item} />;
      break;
    }
    case "reportaje": {
      const item = await getCmsReportaje(id);
      if (!item) notFound();
      title = item.title;
      slug = item.slug;
      isPublished = item.status === "published";
      form = <ReportajeForm categories={categories} existing={item} />;
      break;
    }
    default:
      notFound();
  }

  const publicUrl = `${siteConfig.lamiraUrl}/${LAMIRA_TYPE_PATH[type]}/${slug}`;

  return (
    <CmsShell user={session} title={title}>
      <div className="sticky top-0 z-10 border-b border-border-soft bg-background px-[26px] pt-[26px] pb-4">
        <div className="flex items-center justify-between gap-3">
          <p className="font-mono text-[10px] font-medium tracking-[.1em] text-ink-faint uppercase">{TYPE_LABEL[type]} · La Mira</p>
          <ViewPublishedLink href={publicUrl} available={isPublished} />
        </div>
        <h1 className="mt-3 text-[22px] font-semibold tracking-tight">{title}</h1>
      </div>

      <div className="p-[26px] pb-[60px]">{form}</div>
    </CmsShell>
  );
}
