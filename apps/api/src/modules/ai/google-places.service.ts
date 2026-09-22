import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface NearbyPlace {
  name: string;
  rating: number | null;
  userRatingsTotal: number | null;
  address: string | null;
}

export interface NearbyPlaceCategory {
  type: string;
  label: string;
  places: NearbyPlace[];
}

export interface NearbyPlacesResult {
  zoneName: string;
  categories: NearbyPlaceCategory[];
}

interface GeocodeResponse {
  status: string;
  results: {
    formatted_address: string;
    geometry: { location: { lat: number; lng: number } };
  }[];
}

interface NearbySearchResponse {
  status: string;
  results: {
    name: string;
    rating?: number;
    user_ratings_total?: number;
    vicinity?: string;
  }[];
}

const FETCH_TIMEOUT_MS = 8_000;
const SEARCH_RADIUS_METERS = 5_000;
const PLACES_PER_CATEGORY = 5;

// Tipos de Nearby Search consultados para armar "lo más popular en la zona"
// — Places API no expone volumen real de búsquedas, así que esto es un
// proxy honesto (rating + número de reseñas), nunca se presenta como datos
// de búsqueda reales (ver comentario en env.ts).
const CATEGORY_TYPES: { type: string; label: string }[] = [
  { type: 'restaurant', label: 'Restaurantes' },
  { type: 'cafe', label: 'Cafés' },
  { type: 'bar', label: 'Bares y antros' },
  { type: 'tourist_attraction', label: 'Atracciones' },
  { type: 'shopping_mall', label: 'Centros comerciales' },
  { type: 'park', label: 'Parques' },
];

const MIN_REVIEWS_TO_RANK = 15;

// Zona → lugares mejor calificados cerca de ahí, agrupados por categoría —
// material real de referencia para el modo "Zona" de Centro IA (ver
// centro-ia/page.tsx). Requiere GOOGLE_MAPS_API_KEY; sin ella, lanza un
// error claro en vez de fallar en silencio con resultados vacíos.
@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name);

  constructor(private readonly config: ConfigService) {}

  async popularPlacesNear(query: string): Promise<NearbyPlacesResult> {
    const apiKey = this.config.get<string>('GOOGLE_MAPS_API_KEY');
    if (!apiKey) {
      throw new Error(
        'GOOGLE_MAPS_API_KEY no está configurada — agrégala en el .env del API.',
      );
    }

    const geocoded = await this.geocode(query, apiKey);
    if (!geocoded) {
      throw new Error(`No se encontró la zona "${query}".`);
    }

    const categories = await Promise.all(
      CATEGORY_TYPES.map(async ({ type, label }) => ({
        type,
        label,
        places: await this.nearbySearch(
          geocoded.lat,
          geocoded.lng,
          type,
          apiKey,
        ),
      })),
    );

    return {
      zoneName: geocoded.formattedAddress,
      categories: categories.filter((c) => c.places.length > 0),
    };
  }

  private async geocode(
    query: string,
    apiKey: string,
  ): Promise<{ lat: number; lng: number; formattedAddress: string } | null> {
    const url =
      'https://maps.googleapis.com/maps/api/geocode/json?' +
      new URLSearchParams({
        address: query,
        region: 'mx',
        key: apiKey,
      }).toString();

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as GeocodeResponse;
      const first = data.results[0];
      if (data.status !== 'OK' || !first) return null;
      return {
        lat: first.geometry.location.lat,
        lng: first.geometry.location.lng,
        formattedAddress: first.formatted_address,
      };
    } catch (err) {
      this.logger.warn(
        `Geocoding falló para "${query}": ${(err as Error).message}`,
      );
      return null;
    }
  }

  private async nearbySearch(
    lat: number,
    lng: number,
    type: string,
    apiKey: string,
  ): Promise<NearbyPlace[]> {
    const url =
      'https://maps.googleapis.com/maps/api/place/nearbysearch/json?' +
      new URLSearchParams({
        location: `${lat},${lng}`,
        radius: String(SEARCH_RADIUS_METERS),
        type,
        key: apiKey,
      }).toString();

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as NearbySearchResponse;
      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        this.logger.warn(
          `Nearby Search (${type}) devolvió status ${data.status}`,
        );
      }

      return (data.results ?? [])
        .filter((p) => (p.user_ratings_total ?? 0) >= MIN_REVIEWS_TO_RANK)
        .sort(
          (a, b) =>
            (b.rating ?? 0) * Math.log((b.user_ratings_total ?? 0) + 1) -
            (a.rating ?? 0) * Math.log((a.user_ratings_total ?? 0) + 1),
        )
        .slice(0, PLACES_PER_CATEGORY)
        .map((p) => ({
          name: p.name,
          rating: p.rating ?? null,
          userRatingsTotal: p.user_ratings_total ?? null,
          address: p.vicinity ?? null,
        }));
    } catch (err) {
      this.logger.warn(
        `Nearby Search (${type}) falló: ${(err as Error).message}`,
      );
      return [];
    }
  }
}
