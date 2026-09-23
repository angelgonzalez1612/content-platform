import { Injectable } from '@nestjs/common';
import {
  WebSearchService,
  type WebSearchResult,
} from '../automation/web-search.service';

interface CacheEntry {
  data: WebSearchResult[];
  ts: number;
}

const TTL_MS = 60 * 60 * 1000; // 1 hora — mismo criterio que GoogleTrendsService

// "Búsquedas locales" del mapa de Entidades — a diferencia de Google Trends
// (que no tiene dato confiable a nivel municipio/alcaldía, ver
// GoogleTrendsService/zmvm-municipios-map.ts), esto le pregunta a un
// buscador REAL (mismo Google Custom Search que ya usa "Frases de
// búsqueda") por notas reales sobre ese lugar — ligas reales y citables, no
// un proxy de interés agregado. Si WebSearchService no está configurada
// (falta GOOGLE_SEARCH_API_KEY/GOOGLE_SEARCH_ENGINE_ID), su propio error ya
// trae un mensaje claro — se deja propagar tal cual en vez de ocultarlo.
@Injectable()
export class LocalSearchService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly webSearch: WebSearchService) {}

  // `term` es la categoría "suave": el keyword general (ej. "noticias",
  // "eventos", "tráfico"), no la lista angosta de sucesos. Antes se mandaba
  // `"{lugar}" (accidente OR choque OR ...)`, que encasillaba los resultados en
  // 2-3 tipos de suceso; ahora se busca `{lugar} {tema}` (ej. "México
  // noticias") para traer lo relacionado al lugar en general, guiado por la
  // categoría pero sin cerrarse. `term` vacío = solo el lugar (todo).
  async searchLocal(
    placeName: string,
    term: string,
  ): Promise<WebSearchResult[]> {
    const cacheKey = `${placeName.toLowerCase()}:${term.toLowerCase()}`;
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL_MS) return cached.data;

    const query = `${placeName} ${term}`.trim();
    const results = await this.webSearch.search(query);

    this.cache.set(cacheKey, { data: results, ts: Date.now() });
    return results;
  }
}
