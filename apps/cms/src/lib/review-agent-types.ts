// Mismo shape que apps/api/src/modules/review-agent (ReviewQueueItem / AiReview).

export type ReviewableType = "noticia" | "reportaje" | "guia" | "place" | "evento-planazo" | "planazo-guia";
export type Readiness = "lista" | "casi" | "falta";

export interface ReviewCheck {
  id: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  detail?: string;
  /** Si el Revisor sabe arreglarlo solo: etiqueta del botón "Arreglar". */
  fix?: string;
}

export interface ReviewQueueItem {
  type: ReviewableType;
  site: "la-mira" | "planazo";
  id: string;
  title: string;
  status: string;
  imageUrl: string | null;
  categoryName: string | null;
  createdAt: string | null;
  editHref: string;
  checks: ReviewCheck[];
  readiness: Readiness;
  words: number;
  score: number;
  slug: string;
  /** Última revisión con IA guardada; `stale` = la pieza cambió después de revisarla. */
  ai: { review: AiReview; reviewedAt: string; stale: boolean } | null;
  /** Último arreglo/corrección hecho desde el Revisor (indicador "Corregida"). */
  lastFix: { at: string; message: string } | null;
}

export interface AiReview {
  veredicto: "publicar" | "corregir" | "descartar";
  encaja: "la-mira" | "planazo" | "ninguno";
  resumen: string;
  problemas: string[];
}
