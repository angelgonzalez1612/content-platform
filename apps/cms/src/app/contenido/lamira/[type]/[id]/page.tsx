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
import { VersionHistory } from "@/components/cms/version-history";
import { ViewPublishedLinks } from "@/components/cms/view-published-link";
import { LAMIRA_TYPE_PATH } from "@/lib/lamira-paths";
import { EditPageHeader } from "@/components/cms/edit-page-header";
import { ReviewBar } from "@/components/cms/review-bar";
import { getReviewQueue, isReviewSite } from "@/lib/review-queue";

const TYPE_LABEL: Record<string, string> = {
  noticia: "Noticia",
  alerta: "Alerta",
  guia: "Guía",
  evento: "Evento",
  lugar: "Lugar",
  reportaje: "Reportaje",
};

export default async function EditLamiraContentPage({
  params,
  searchParams,
}: {
  params: Promise<{ type: string; id: string }>;
  searchParams: Promise<{ revision?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { type, id } = await params;
  const { revision } = await searchParams;
  const reviewQueue = isReviewSite(revision) ? await getReviewQueue(revision) : null;
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


  return (
    <CmsShell user={session} title={title}>
      <EditPageHeader
        kicker={`${TYPE_LABEL[type]} · La Mira`}
        title={title}
        actions={<ViewPublishedLinks site="la-mira" path={`${LAMIRA_TYPE_PATH[type]}/${slug}`} available={isPublished} />}
        review={reviewQueue && isReviewSite(revision) ? <ReviewBar site={revision} queue={reviewQueue} currentHref={`/contenido/lamira/${type}/${id}`} /> : undefined}
      />

      <div className="flex flex-col gap-4 p-[26px] pt-5 pb-[60px]">
        <VersionHistory contentType={type} contentId={id} />
        {form}
      </div>
    </CmsShell>
  );
}
