import { cookies } from "next/headers";
import { apiConfig } from "@planazo/config";
import type { Place, PlaceDetail, Category, Seo, Noticia, Alerta, Guia, LamiraEvento, LamiraLugar, Reportaje, PlanazoEvent, ContentBlock } from "@planazo/types";
import type { AutomationRule, AutomationRun } from "./automation-types";

async function cmsFetch(path: string, init?: RequestInit) {
  const cookieStore = await cookies();
  return fetch(`${apiConfig.baseUrl}${path}`, {
    ...init,
    headers: { cookie: cookieStore.toString(), ...init?.headers },
    cache: "no-store",
  });
}

// Temas de Content Radar ya publicados — para marcarlos como hechos en el
// reporte (ver content-radar/page.tsx) en vez de invitar a publicarlos otra
// vez. Lista completa, sin paginación — el volumen es bajo (un puñado de
// temas al día).
export async function getContentRadarPublishedTitles(): Promise<string[]> {
  const res = await cmsFetch("/cms/content-radar/published-topics");
  if (!res.ok) return [];
  return res.json();
}

export async function getCmsPlaces(): Promise<Place[]> {
  const res = await cmsFetch("/cms/places");
  if (!res.ok) return [];
  return res.json();
}

export async function getCmsPlace(id: string): Promise<PlaceDetail | null> {
  const res = await cmsFetch(`/cms/places/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export interface UpdatePlaceInput {
  name?: string;
  description?: string | null;
  zone?: string | null;
  alcaldiaSlug?: string | null;
  address?: string | null;
  priceLevel?: number | null;
  price?: number | null;
  rating?: number | null;
  phone?: string | null;
  website?: string | null;
  status?: Place["status"];
  categoryData?: Record<string, unknown>;
  seo?: Seo | null;
  // Reemplaza la portada (photos[0]) — `null` la quita, ausente la deja
  // intacta (ver PlacesService.update).
  photo?: { url: string; credit?: string | null } | null;
  content?: ContentBlock[];
  allowPhotoModal?: boolean;
}

/** Sin `site`: todas las categorías. Con `site`: las de ese sitio + las compartidas. */
export async function getCmsCategories(site?: "la-mira" | "planazo"): Promise<Category[]> {
  const qs = site ? `?site=${site}` : "";
  const res = await cmsFetch(`/cms/categories${qs}`);
  if (!res.ok) return [];
  return res.json();
}

export async function getCmsCategory(id: string): Promise<Category | null> {
  const res = await cmsFetch(`/cms/categories/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getAutomationRules(): Promise<AutomationRule[]> {
  const res = await cmsFetch("/cms/automation/rules");
  if (!res.ok) return [];
  return res.json();
}

export async function getAutomationRuns(): Promise<AutomationRun[]> {
  const res = await cmsFetch("/cms/automation/runs");
  if (!res.ok) return [];
  return res.json();
}

export interface AutomationStatus {
  lastCheckedAt: string | null;
  checkIntervalMinutes: number;
  activeRulesCount: number;
  isRunning: boolean;
}

export async function getAutomationStatus(): Promise<AutomationStatus> {
  const res = await cmsFetch("/cms/automation/status");
  if (!res.ok) return { lastCheckedAt: null, checkIntervalMinutes: 15, activeRulesCount: 0, isRunning: false };
  return res.json();
}

export async function getAiSettingsStatus(): Promise<{ openaiApiKeySet: boolean; openaiApiKeyPreview: string | null }> {
  const res = await cmsFetch("/cms/settings/ai");
  if (!res.ok) return { openaiApiKeySet: false, openaiApiKeyPreview: null };
  return res.json();
}

/**
 * Lectura de solo-visualización sobre los 6 tipos de contenido de la-mira
 * (backend ya tiene su CRUD completo desde la Fase 2; el CMS todavía no
 * tiene formularios propios para ellos — esto solo confirma que la
 * conexión CMS -> content-platform -> la-mira ya sirve datos reales).
 */
export interface LamiraContentRow {
  id: string;
  type: "noticia" | "alerta" | "guia" | "evento" | "lugar" | "reportaje";
  title: string;
  slug: string;
  categoryId: string | null;
  categoryName: string;
  status: string;
  // alerta/evento/lugar no tienen workflow de borrador — cualquier fila es
  // pública de inmediato (ver AiDraftService); noticia/guia/reportaje solo
  // cuando status === "published" (filtro real del backend público).
  isPublished: boolean;
  date: string;
  // Solo noticia/reportaje la traen — el artículo original del que salió el
  // tema (Milenio, Reforma, etc.), capturado solo cuando lo crea la
  // automatización. Ver la columna "Fuente" en /contenido.
  sourceUrl: string | null;
}

async function safeList<T>(path: string): Promise<T[]> {
  const res = await cmsFetch(path);
  if (!res.ok) return [];
  return res.json();
}

export async function getCmsLamiraContent(): Promise<LamiraContentRow[]> {
  const [noticias, alertas, guias, eventos, lugares, reportajes] = await Promise.all([
    safeList<Noticia>("/cms/lamira/noticias"),
    safeList<Alerta>("/cms/lamira/alertas"),
    safeList<Guia>("/cms/lamira/guias"),
    safeList<LamiraEvento>("/cms/lamira/eventos"),
    safeList<LamiraLugar>("/cms/lamira/lugares"),
    safeList<Reportaje>("/cms/lamira/reportajes"),
  ]);

  const rows: LamiraContentRow[] = [
    ...noticias.map((n) => ({ id: n.id, type: "noticia" as const, title: n.title, slug: n.slug, categoryId: n.category?.id ?? null, categoryName: n.category?.name ?? "—", status: n.status, isPublished: n.status === "published", date: n.updatedAt ?? n.createdAt, sourceUrl: n.sourceUrl })),
    ...alertas.map((a) => ({ id: a.id, type: "alerta" as const, title: a.title, slug: a.slug, categoryId: a.category?.id ?? null, categoryName: a.category?.name ?? "—", status: a.alertaStatus, isPublished: true, date: a.updatedAt, sourceUrl: null })),
    ...guias.map((g) => ({ id: g.id, type: "guia" as const, title: g.title, slug: g.slug, categoryId: g.category?.id ?? null, categoryName: g.category?.name ?? "—", status: g.status, isPublished: g.status === "published", date: g.updatedAt, sourceUrl: null })),
    ...eventos.map((e) => ({ id: e.id, type: "evento" as const, title: e.title, slug: e.slug, categoryId: e.category?.id ?? null, categoryName: e.category?.name ?? "—", status: e.eventoStatus, isPublished: true, date: e.createdAt, sourceUrl: null })),
    ...lugares.map((l) => ({ id: l.id, type: "lugar" as const, title: l.name, slug: l.slug, categoryId: l.category?.id ?? null, categoryName: l.category?.name ?? "—", status: "—", isPublished: true, date: l.createdAt, sourceUrl: null })),
    ...reportajes.map((r) => ({ id: r.id, type: "reportaje" as const, title: r.title, slug: r.slug, categoryId: r.category?.id ?? null, categoryName: r.category?.name ?? "—", status: r.status, isPublished: r.status === "published", date: r.publishedAt, sourceUrl: r.sourceUrl })),
  ];

  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

/** Getters de un solo item por tipo — los usan las páginas de edición
 * (server components) de `/contenido/lamira/[type]/[id]`. Mismo patrón que
 * `getCmsPlace`: `null` si no existe o el fetch falla (404 -> notFound()). */
async function safeOne<T>(path: string): Promise<T | null> {
  const res = await cmsFetch(path);
  if (!res.ok) return null;
  return res.json();
}

export async function getCmsNoticia(id: string): Promise<Noticia | null> {
  return safeOne<Noticia>(`/cms/lamira/noticias/${id}`);
}
export async function getCmsAlerta(id: string): Promise<Alerta | null> {
  return safeOne<Alerta>(`/cms/lamira/alertas/${id}`);
}
export async function getCmsGuia(id: string): Promise<Guia | null> {
  return safeOne<Guia>(`/cms/lamira/guias/${id}`);
}
export async function getCmsLamiraEvento(id: string): Promise<LamiraEvento | null> {
  return safeOne<LamiraEvento>(`/cms/lamira/eventos/${id}`);
}
export async function getCmsLamiraLugar(id: string): Promise<LamiraLugar | null> {
  return safeOne<LamiraLugar>(`/cms/lamira/lugares/${id}`);
}
export async function getCmsReportaje(id: string): Promise<Reportaje | null> {
  return safeOne<Reportaje>(`/cms/lamira/reportajes/${id}`);
}

/** Eventos de Planazo (evento-planazo) — mismo patrón que places/la-mira. */
export async function getCmsEvents(): Promise<PlanazoEvent[]> {
  return safeList<PlanazoEvent>("/cms/events");
}

export async function getCmsEvent(id: string): Promise<PlanazoEvent | null> {
  return safeOne<PlanazoEvent>(`/cms/events/${id}`);
}
