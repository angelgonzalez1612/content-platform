// 'scheduled' se agregó al unificar con el ContentStatus que la-mira ya
// definía (5 estados en español: borrador/revision/programado/publicado/
// archivado) — el mapeo español↔inglés vive en la capa de UI, no aquí.
export type ContentStatus = 'draft' | 'in_review' | 'scheduled' | 'published' | 'archived';

export type UserRole = 'admin' | 'editor';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface Site {
  id: string;
  slug: string; // 'la-mira' | 'planazo'
  name: string;
  domain: string | null;
}

export type FieldType = 'text' | 'textarea' | 'number' | 'boolean' | 'date' | 'select' | 'multiselect';

/**
 * One entry in a Category's field_schema — defines one category-specific
 * form field (e.g. "destino" for Viajes, "linea" for Metro). `isFact: true`
 * means the AI editorial agent must never invent/alter this field without
 * explicit human confirmation, same spirit as address/phone/price on Place.
 */
export interface FieldSchemaEntry {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  isFact?: boolean;
  options?: string[]; // for 'select' / 'multiselect'
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  siteId: string | null; // null = shared between sites
  fieldSchema: FieldSchemaEntry[];
}

/** Per-item SEO override — falls back to the content's own title/description
 * when absent. Present on every content type (see docs/plans for which
 * types lacked it before the multi-site schema). */
export interface Seo {
  title?: string;
  description?: string;
  canonical?: string;
  ogImage?: string;
}

/** Un check automático del agente editorial (ver checks.service.ts en apps/api). */
export interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
  blocking: boolean;
}

export type AiDecision = "auto-published" | "needs-review";

export interface AiDraftResult {
  draft: Record<string, unknown>;
  checksRun: CheckResult[];
  decision: AiDecision;
  image: { url: string; credit: string } | null;
  // La categoría con la que se generó el draft — clasificada por la IA
  // cuando el caller no mandó categoryId. El CMS la preselecciona, editable.
  categoryId: string;
  // Sitio + tipo de contenido con el que se generó — clasificados por la IA
  // cuando el caller no mandó `site`/`contentType` (flujo de Publicar desde
  // content-radar, que ya no fija el destino de antemano). El CMS los usa
  // para saber qué formulario de revisión mostrar.
  site: 'la-mira' | 'planazo';
  contentType: string;
}

// ── Los 6 tipos de contenido editorial de la-mira ───────────────────────────
// Reflejan 1:1 sus tablas en apps/api/src/db/schema/lamira.ts — cada uno
// deliberadamente con su propia forma, sin interfaz base compartida (ver
// Fase 1 del plan de arquitectura: la-mira/src/lib/types.ts ya está así).

export interface TocEntry {
  id: string;
  label: string;
}

export interface ContentBlock {
  heading?: string | null;
  paragraphs: string[];
}

export interface Noticia {
  id: string;
  slug: string;
  siteId: string;
  title: string;
  dek: string;
  category: Category | null;
  alcaldiaSlug: string | null;
  colonia: string | null;
  authorSlug: string;
  publishedAt: string;
  updatedAt: string | null;
  readingTime: string;
  status: ContentStatus;
  sourceKind: string | null;
  externalSource: string | null;
  youtubeId: string | null;
  tags: string[];
  seo: Seo | null;
  toc: TocEntry[];
  content: ContentBlock[];
  imageCaption: string | null;
  imageUrl: string | null;
  imageCredit: string | null;
  featured: boolean;
  tag: string | null;
  categoryData: Record<string, unknown>;
  createdAt: string;
}

export type AlertaStatus = "activa" | "en-seguimiento" | "resuelta";

export interface Alerta {
  id: string;
  slug: string;
  siteId: string;
  title: string;
  alertaStatus: AlertaStatus;
  category: Category | null;
  alcaldiaSlug: string | null;
  updatedAt: string;
  description: string;
  updates: { time: string; text: string }[];
  seo: Seo | null;
  imageUrl: string | null;
  imageCredit: string | null;
  categoryData: Record<string, unknown>;
  createdAt: string;
}

export interface Guia {
  id: string;
  slug: string;
  siteId: string;
  title: string;
  dek: string;
  groupSlug: string;
  category: Category | null;
  updatedAt: string;
  readingTime: string;
  status: ContentStatus;
  officialSource: { label: string; url: string } | null;
  quickFacts: { label: string; value: string }[];
  seo: Seo | null;
  toc: TocEntry[];
  content: { id: string; heading: string; paragraphs: string[] }[];
  faq: { question: string; answer: string }[];
  imageUrl: string | null;
  imageCredit: string | null;
  categoryData: Record<string, unknown>;
  createdAt: string;
}

export type EventoStatus = "proximo" | "en-curso" | "finalizado" | "cancelado";

export interface LamiraEvento {
  id: string;
  slug: string;
  siteId: string;
  title: string;
  tag: string;
  category: Category | null;
  eventoStatus: EventoStatus;
  date: string;
  time: string;
  location: string;
  alcaldiaSlug: string | null;
  price: string;
  description: string;
  organizer: string;
  officialUrl: string | null;
  seo: Seo | null;
  imageUrl: string | null;
  imageCredit: string | null;
  categoryData: Record<string, unknown>;
  createdAt: string;
}

export type LugarKind = "parque" | "plaza" | "museo" | "monumento" | "colonia" | "estacion-metro" | "estacion-metrobus";

export interface LamiraLugar {
  id: string;
  slug: string;
  siteId: string;
  name: string;
  kind: LugarKind;
  category: Category | null;
  alcaldiaSlug: string;
  colonia: string | null;
  description: string;
  seo: Seo | null;
  imageUrl: string | null;
  imageCredit: string | null;
  categoryData: Record<string, unknown>;
  createdAt: string;
}

export interface Reportaje {
  id: string;
  slug: string;
  siteId: string;
  title: string;
  dek: string;
  authorSlug: string;
  category: Category | null;
  publishedAt: string;
  readingTime: string;
  status: ContentStatus;
  tags: string[];
  sourceKind: string | null;
  seo: Seo | null;
  imageCaption: string;
  imageUrl: string | null;
  imageCredit: string | null;
  toc: TocEntry[];
  content: ContentBlock[];
  categoryData: Record<string, unknown>;
  createdAt: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface ServiceAmenity {
  id: string;
  name: string;
  slug: string;
}

export interface Photo {
  id: string;
  url: string;
  alt: string | null;
  position: number;
}

export interface SocialLink {
  id: string;
  platform: string;
  url: string;
}

export interface OpeningHour {
  id: string;
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  closed: boolean;
}

export interface Promotion {
  id: string;
  title: string;
  description: string | null;
  discountLabel: string | null;
  startDate: string | null;
  endDate: string | null;
  status: ContentStatus;
}

export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
}

export interface Article extends ArticleSummary {
  content: string | null;
  status: ContentStatus;
  aiGenerated: boolean;
  sourceKeyword: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  ogImageUrl: string | null;
  categoryData: Record<string, unknown>;
  places: Place[];
  createdAt: string;
  updatedAt: string;
}

/**
 * The central knowledge-graph entity. A Place is reused across articles,
 * rankings, events and promotions instead of duplicating data per content type.
 */
export interface Place {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  zone: string | null;
  latitude: string | null;
  longitude: string | null;
  address: string | null;
  priceLevel: number | null;
  price: number | null;
  rating: number | null;
  reviewCount: number;
  phone: string | null;
  website: string | null;
  status: ContentStatus;
  categories: Category[];
  tags: Tag[];
  photos: Photo[];
  categoryData: Record<string, unknown>;
  seo: Seo | null;
  createdAt: string;
  updatedAt: string;
}

export interface PlaceDetail extends Place {
  services: ServiceAmenity[];
  socialLinks: SocialLink[];
  openingHours: OpeningHour[];
  promotions: Promotion[];
  articles: ArticleSummary[];
}

export interface Ranking {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  places: Array<{ place: Place; position: number }>;
}

export interface PlanazoEvent {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  locationName: string | null;
  place: Place | null;
  categoryId: string | null;
  status: ContentStatus;
  categoryData: Record<string, unknown>;
  seo: Seo | null;
}

export const PLACE_CATEGORY_SLUGS = ['comer', 'cafes', 'bares', 'cultura', 'aire-libre', 'tecnologia'] as const;
export type PlaceCategorySlug = (typeof PLACE_CATEGORY_SLUGS)[number];

/** Input to POST /cms/ai/generate-place — only what a human editor already knows. */
export interface PlaceDraftInput {
  name: string;
  hints?: string;
}

/** AI-generated draft — never includes address/phone/price; those are human-verified. */
export interface PlaceDraftOutput {
  description: string;
  suggestedCategory: PlaceCategorySlug;
  suggestedTags: string[];
}
