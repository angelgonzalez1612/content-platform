import { getCmsLamiraContent, getCmsPlanazoContent } from "@/lib/cms-api";

export type ReviewSite = "lamira" | "planazo";

export interface ReviewItem {
  /** Ruta de la ficha de edición (sin el parámetro de revisión). */
  href: string;
  title: string;
  typeLabel: string;
  date: string;
}

export function isReviewSite(value: string | undefined): value is ReviewSite {
  return value === "lamira" || value === "planazo";
}

/** Tabla de Contenido del sitio, opcionalmente con parámetros extra. */
export function contenidoHref(site: ReviewSite, extra = ""): string {
  const params = [site === "lamira" ? "site=lamira" : "", extra].filter(Boolean).join("&");
  return params ? `/contenido?${params}` : "/contenido";
}

/** Ficha de edición con el modo revisión activo. */
export function reviewHref(href: string, site: ReviewSite): string {
  return `${href}?revision=${site}`;
}

const LAMIRA_TYPE_LABEL: Record<string, string> = {
  noticia: "Noticia",
  alerta: "Alerta",
  guia: "Guía",
  evento: "Evento",
  lugar: "Lugar",
  reportaje: "Reportaje",
};

/**
 * Piezas "En revisión" de un sitio, la más reciente primero — la cola que
 * recorre el modo revisión de Contenido (aviso ⏳ → primera pieza → flechas
 * anterior/siguiente en la ficha). Mismo criterio de fecha que la tabla de
 * Contenido, para que "la primera" sea la de arriba de la tabla.
 */
export async function getReviewQueue(site: ReviewSite): Promise<ReviewItem[]> {
  if (site === "lamira") {
    const rows = await getCmsLamiraContent();
    return rows
      .filter((r) => r.status === "in_review")
      .map((r) => ({
        href: `/contenido/lamira/${r.type}/${r.id}`,
        title: r.title,
        typeLabel: LAMIRA_TYPE_LABEL[r.type] ?? r.type,
        date: r.date,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  const { places, events, guides } = await getCmsPlanazoContent();
  return [
    ...places
      .filter((p) => p.status === "in_review")
      .map((p) => ({ href: `/contenido/${p.id}`, title: p.name, typeLabel: "Lugar", date: p.updatedAt })),
    ...events
      .filter((e) => e.status === "in_review")
      .map((e) => ({ href: `/contenido/planazo-evento/${e.id}`, title: e.name, typeLabel: "Evento", date: e.startDate ?? "" })),
    ...guides
      .filter((g) => g.status === "in_review")
      .map((g) => ({ href: `/contenido/planazo-guia/${g.id}`, title: g.title, typeLabel: "Guía", date: g.updatedAt })),
  ].sort((a, b) => b.date.localeCompare(a.date));
}
