import { cookies } from "next/headers";
import { apiConfig } from "@planazo/config";
import type { Place, PlaceDetail, Category, Seo, Noticia, Alerta, Guia, LamiraEvento, LamiraLugar, Reportaje } from "@planazo/types";

async function cmsFetch(path: string, init?: RequestInit) {
  const cookieStore = await cookies();
  return fetch(`${apiConfig.baseUrl}${path}`, {
    ...init,
    headers: { cookie: cookieStore.toString(), ...init?.headers },
    cache: "no-store",
  });
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
  address?: string | null;
  priceLevel?: number | null;
  price?: number | null;
  rating?: number | null;
  phone?: string | null;
  website?: string | null;
  status?: Place["status"];
  categoryData?: Record<string, unknown>;
  seo?: Seo | null;
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
  categoryName: string;
  status: string;
  date: string;
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
    ...noticias.map((n) => ({ id: n.id, type: "noticia" as const, title: n.title, categoryName: n.category?.name ?? "—", status: n.status, date: n.updatedAt ?? n.createdAt })),
    ...alertas.map((a) => ({ id: a.id, type: "alerta" as const, title: a.title, categoryName: a.category?.name ?? "—", status: a.alertaStatus, date: a.updatedAt })),
    ...guias.map((g) => ({ id: g.id, type: "guia" as const, title: g.title, categoryName: g.category?.name ?? "—", status: g.status, date: g.updatedAt })),
    ...eventos.map((e) => ({ id: e.id, type: "evento" as const, title: e.title, categoryName: e.category?.name ?? "—", status: e.eventoStatus, date: e.createdAt })),
    ...lugares.map((l) => ({ id: l.id, type: "lugar" as const, title: l.name, categoryName: l.category?.name ?? "—", status: "—", date: l.createdAt })),
    ...reportajes.map((r) => ({ id: r.id, type: "reportaje" as const, title: r.title, categoryName: r.category?.name ?? "—", status: r.status, date: r.publishedAt })),
  ];

  return rows.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
