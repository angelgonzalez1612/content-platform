// Mismo shape que apps/api/src/modules/review-agent (ReviewQueueItem / AiReview).

export type ReviewableType = "noticia" | "reportaje" | "guia" | "place" | "evento-planazo" | "planazo-guia";
export type Readiness = "lista" | "casi" | "falta";

export interface ReviewCheck {
  id: string;
  label: string;
  passed: boolean;
  blocking: boolean;
  detail?: string;
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
}

export interface AiReview {
  veredicto: "publicar" | "corregir" | "descartar";
  encaja: "la-mira" | "planazo" | "ninguno";
  resumen: string;
  problemas: string[];
}
