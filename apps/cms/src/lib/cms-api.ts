import { cookies } from "next/headers";
import { apiConfig } from "@planazo/config";
import type { Place, PlaceDetail, Category, Seo } from "@planazo/types";

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
