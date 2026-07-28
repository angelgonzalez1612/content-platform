import { cookies } from "next/headers";
import { apiConfig } from "@planazo/config";
import type { Place, PlaceDetail } from "@planazo/types";

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
  address?: string | null;
  priceLevel?: number | null;
  phone?: string | null;
  website?: string | null;
  status?: Place["status"];
}
