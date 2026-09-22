import { Injectable, Logger } from '@nestjs/common';
// google-trends-api no publica tipos — noImplicitAny está desactivado en
// este proyecto (ver tsconfig.json), así que el import queda `any` a propósito.
import googleTrends from 'google-trends-api';
import { MEXICO_STATES, findStateCodeByGeoName } from './mexico-states';

export interface StateInterest {
  code: string;
  name: string;
  value: number;
}

export interface RelatedQuery {
  query: string;
  value: number;
  breakout: boolean;
}

export interface StatePhrases {
  top: RelatedQuery[];
  rising: RelatedQuery[];
}

// Google Trends (vía este paquete no oficial) es un scraper del sitio
// público de Trends, no una API con key — cuando Google detecta el patrón de
// bot devuelve HTML en vez de JSON. Cuando eso pasa, se lanza este error en
// vez de inventar números "estimados" (ver mexico-states.ts/entidades.
// controller.ts) — el mapa debe mostrar "no disponible" honestamente, nunca
// un dato que parezca real sin serlo.
export class TrendsUnavailableError extends Error {
  constructor(detail: string) {
    super(`Google Trends no está disponible ahora mismo: ${detail}`);
    this.name = 'TrendsUnavailableError';
  }
}

interface CacheEntry<T> {
  data: T;
  ts: number;
}

const TTL_MS = 60 * 60 * 1000; // 1 hora — mismo TTL que prospect-finder
const FETCH_ERROR = 'la solicitud falló o fue bloqueada';

function isJson(raw: unknown): raw is string {
  const s = typeof raw === 'string' ? raw.trim() : '';
  return s.startsWith('{') || s.startsWith('[');
}

@Injectable()
export class GoogleTrendsService {
  private readonly logger = new Logger(GoogleTrendsService.name);
  private readonly interestCache = new Map<
    string,
    CacheEntry<StateInterest[]>
  >();
  private readonly phrasesCache = new Map<string, CacheEntry<StatePhrases>>();

  // Interés relativo de búsqueda (0-100) por estado para una palabra clave —
  // UNA sola llamada a Trends cubre los 32 estados (resolution: REGION),
  // nunca 32 llamadas separadas. Los estados sin dato en la respuesta se
  // devuelven con value 0 (no se omiten, o el mapa quedaría con huecos).
  async interestByState(keyword: string): Promise<StateInterest[]> {
    const cacheKey = keyword.toLowerCase();
    const cached = this.interestCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL_MS) return cached.data;

    let raw: unknown;
    try {
      raw = await googleTrends.interestByRegion({
        keyword,
        geo: 'MX',
        resolution: 'REGION',
        hl: 'es',
      });
    } catch (err) {
      this.logger.warn(
        `interestByRegion falló para "${keyword}": ${(err as Error).message}`,
      );
      throw new TrendsUnavailableError(FETCH_ERROR);
    }

    if (!isJson(raw)) {
      this.logger.warn(
        `interestByRegion devolvió HTML (bloqueado) para "${keyword}"`,
      );
      throw new TrendsUnavailableError(FETCH_ERROR);
    }

    const parsed = JSON.parse(raw) as {
      default?: { geoMapData?: { geoName: string; value: number[] }[] };
    };
    const byCode = new Map<string, number>();
    for (const row of parsed.default?.geoMapData ?? []) {
      const code = findStateCodeByGeoName(row.geoName);
      if (code) byCode.set(code, row.value[0] ?? 0);
    }

    const result: StateInterest[] = MEXICO_STATES.map((s) => ({
      code: s.code,
      name: s.name,
      value: byCode.get(s.code) ?? 0,
    }));

    this.interestCache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  }

  // Frases reales que la gente busca junto con `keyword` en un estado
  // específico (geo: MX-XXX) — "Top" (más buscadas) y "Rising" (que más
  // crecieron). Vacío (no error) cuando Trends respondió pero no tiene datos
  // para esa combinación estado+palabra — distinto de "Trends bloqueado".
  async phrasesForState(
    stateCode: string,
    keyword: string,
  ): Promise<StatePhrases> {
    const cacheKey = `${stateCode}:${keyword.toLowerCase()}`;
    const cached = this.phrasesCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < TTL_MS) return cached.data;

    let raw: unknown;
    try {
      raw = await googleTrends.relatedQueries({
        keyword,
        geo: `MX-${stateCode.toUpperCase()}`,
        hl: 'es',
      });
    } catch (err) {
      this.logger.warn(
        `relatedQueries falló para "${keyword}" en ${stateCode}: ${(err as Error).message}`,
      );
      throw new TrendsUnavailableError(FETCH_ERROR);
    }

    if (!isJson(raw)) {
      this.logger.warn(
        `relatedQueries devolvió HTML (bloqueado) para "${keyword}" en ${stateCode}`,
      );
      throw new TrendsUnavailableError(FETCH_ERROR);
    }

    const parsed = JSON.parse(raw) as {
      default?: {
        rankedList?: {
          rankedKeyword?: {
            query: string;
            value: number;
            formattedValue?: string;
          }[];
        }[];
      };
    };
    const [topList, risingList] = parsed.default?.rankedList ?? [];

    const result: StatePhrases = {
      top: (topList?.rankedKeyword ?? []).map((k) => ({
        query: k.query,
        value: k.value,
        breakout: false,
      })),
      rising: (risingList?.rankedKeyword ?? []).map((k) => ({
        query: k.query,
        value: k.value,
        breakout: k.formattedValue === 'Breakout',
      })),
    };

    this.phrasesCache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  }
}
