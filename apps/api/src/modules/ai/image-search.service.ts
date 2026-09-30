import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebSearchService } from '../automation/web-search.service';
import { ArticleScraperService } from './article-scraper.service';

export interface ImageSearchResult {
  url: string;
  thumbUrl: string;
  credit: string;
  sourcePageUrl: string;
  source: 'wikimedia' | 'openverse' | 'pexels' | 'news';
  /** Titular de la nota de donde salió la foto (solo `news`). */
  title?: string;
}

interface WikimediaImageInfo {
  url: string;
  thumburl?: string;
  mime?: string;
  descriptionurl?: string;
  extmetadata?: {
    Artist?: { value?: string };
    LicenseShortName?: { value?: string };
  };
}

interface WikimediaPage {
  title: string;
  imageinfo?: WikimediaImageInfo[];
}

interface OpenverseResult {
  url: string;
  thumbnail?: string;
  creator?: string;
  license?: string;
  foreign_landing_url?: string;
}

interface PexelsPhoto {
  url: string;
  photographer?: string;
  src?: { large2x?: string; large?: string; medium?: string };
}

const RESULT_LIMIT_PER_SOURCE = 9;
const FETCH_TIMEOUT_MS = 8_000;
// Fotos de notas: el scraper abre un Chromium por nota (Playwright), así que
// se leen de a pocas a la vez — 8 simultáneas saturaban la máquina y todas se
// pasaban del tiempo. Pasado NEWS_DEADLINE_MS se devuelve lo encontrado.
const NEWS_ARTICLES = 8;
const NEWS_CONCURRENCY = 3;
const NEWS_ARTICLE_TIMEOUT_MS = 30_000;
const NEWS_DEADLINE_MS = 45_000;
// Leer las notas tarda; la misma búsqueda (p.ej. "Fotos" de un municipio en
// Entidades al ir y volver entre pestañas) se sirve de memoria un rato.
const NEWS_CACHE_TTL_MS = 30 * 60 * 1000;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([promise, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

// Búsqueda de imágenes para adjuntar a un borrador — no las genera/inventa la
// IA, es el humano quien elige de una lista real de resultados, y el crédito
// siempre viene de una fuente real, nunca inventado.
// - Wikimedia Commons y Openverse: sin API key, licencia + autor estructurados,
//   solo licencias que permiten uso comercial.
// - Pexels (opcional, solo si hay PEXELS_API_KEY): fotos de stock gratuitas,
//   crédito al fotógrafo. Útil para temas genéricos (cafés, parques, comida).
// - Fotos de notas (searchNews): la foto principal de notas reales sobre el
//   mismo tema (Google News), con crédito al medio — mismo criterio que
//   "Desde otra fuente" (solo la imagen, nunca el texto).
// Bing Image Search se quitó: Microsoft retiró esa API en agosto de 2025.
@Injectable()
export class ImageSearchService {
  private readonly logger = new Logger(ImageSearchService.name);
  private readonly newsCache = new Map<string, { data: ImageSearchResult[]; ts: number }>();

  constructor(
    private readonly config: ConfigService,
    private readonly webSearch: WebSearchService,
    private readonly scraper: ArticleScraperService,
  ) {}

  isPexelsConfigured(): boolean {
    return !!this.config.get<string>('PEXELS_API_KEY');
  }

  async search(query: string): Promise<ImageSearchResult[]> {
    const [wikimedia, openverse, pexels] = await Promise.all([this.searchWikimedia(query), this.searchOpenverse(query), this.searchPexels(query)]);
    return [...wikimedia, ...openverse, ...pexels];
  }

  async searchWikimedia(query: string): Promise<ImageSearchResult[]> {
    const url =
      'https://commons.wikimedia.org/w/api.php?' +
      new URLSearchParams({
        action: 'query',
        generator: 'search',
        gsrsearch: query,
        gsrnamespace: '6',
        gsrlimit: '16',
        prop: 'imageinfo',
        iiprop: 'url|extmetadata|mime',
        iiurlwidth: '400',
        format: 'json',
        origin: '*',
      }).toString();

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) return [];
      const data = (await res.json()) as { query?: { pages?: Record<string, WikimediaPage> } };
      const pages = Object.values(data.query?.pages ?? {});

      return pages
        .map((p) => p.imageinfo?.[0] && { info: p.imageinfo[0] })
        .filter((x): x is { info: WikimediaImageInfo } => {
          if (!x || !x.info.thumburl) return false;
          const mime = x.info.mime ?? '';
          // Wikimedia Commons indexa formatos con mime "image/*" que ningún
          // navegador puede mostrar como <img> — visto en vivo: un .djvu
          // (documento escaneado) pasó el filtro y quedó guardado como
          // "imagen" de un evento, mostrando nada en el sitio real.
          if (!mime.startsWith('image/')) return false;
          if (/djvu|tiff/i.test(mime)) return false;
          return true;
        })
        .map(({ info }) => {
          const artist = stripHtml(info.extmetadata?.Artist?.value ?? '');
          const license = info.extmetadata?.LicenseShortName?.value ?? '';
          const attribution = [artist, license].filter(Boolean).join(' · ') || 'Wikimedia Commons';
          return {
            url: info.url,
            thumbUrl: info.thumburl!,
            credit: `${attribution} (Wikimedia Commons)`,
            sourcePageUrl: info.descriptionurl ?? info.url,
            source: 'wikimedia' as const,
          };
        })
        .slice(0, RESULT_LIMIT_PER_SOURCE);
    } catch (err) {
      this.logger.warn(`Búsqueda en Wikimedia falló para "${query}": ${(err as Error).message}`);
      return [];
    }
  }

  async searchOpenverse(query: string): Promise<ImageSearchResult[]> {
    const url =
      'https://api.openverse.org/v1/images/?' +
      new URLSearchParams({
        q: query,
        page_size: String(RESULT_LIMIT_PER_SOURCE),
        // Solo licencias que permiten uso comercial (by/by-sa/cc0/pdm) — un
        // sitio con anuncios reales (AdSense) no debe usar imágenes NC.
        license_type: 'commercial',
        mature: 'false',
      }).toString();

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) return [];
      const data = (await res.json()) as { results?: OpenverseResult[] };
      return (data.results ?? [])
        .filter((r) => r.url && r.thumbnail)
        .map((r) => ({
          url: r.url,
          thumbUrl: r.thumbnail!,
          credit: `${r.creator ?? 'Autor desconocido'} (${(r.license ?? 'CC').toUpperCase()} · Openverse)`,
          sourcePageUrl: r.foreign_landing_url ?? r.url,
          source: 'openverse' as const,
        }));
    } catch (err) {
      this.logger.warn(`Búsqueda en Openverse falló para "${query}": ${(err as Error).message}`);
      return [];
    }
  }

  async searchPexels(query: string): Promise<ImageSearchResult[]> {
    const apiKey = this.config.get<string>('PEXELS_API_KEY');
    if (!apiKey) return [];

    const url =
      'https://api.pexels.com/v1/search?' +
      new URLSearchParams({ query, per_page: String(RESULT_LIMIT_PER_SOURCE), locale: 'es-ES' }).toString();

    try {
      const res = await fetch(url, { headers: { Authorization: apiKey }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) return [];
      const data = (await res.json()) as { photos?: PexelsPhoto[] };
      return (data.photos ?? [])
        .filter((p) => p.src?.large && p.src?.medium)
        .map((p) => ({
          url: p.src!.large2x ?? p.src!.large!,
          thumbUrl: p.src!.medium!,
          credit: `Foto: ${p.photographer ?? 'Pexels'} (Pexels)`,
          sourcePageUrl: p.url,
          source: 'pexels' as const,
        }));
    } catch (err) {
      this.logger.warn(`Búsqueda en Pexels falló para "${query}": ${(err as Error).message}`);
      return [];
    }
  }

  /**
   * Fotos reales de notas sobre el mismo tema: busca en Google News, lee cada
   * nota en paralelo y se queda solo con su imagen principal (nunca el texto).
   * El crédito es el medio que publicó la nota.
   */
  async searchNews(query: string): Promise<ImageSearchResult[]> {
    const cacheKey = query.trim().toLowerCase();
    const cached = this.newsCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < NEWS_CACHE_TTL_MS) return cached.data;

    const articles = (await this.webSearch.search(query)).slice(0, NEWS_ARTICLES);
    const found: ImageSearchResult[] = [];
    const seen = new Set<string>();
    const deadline = Date.now() + NEWS_DEADLINE_MS;
    let next = 0;

    const worker = async () => {
      while (next < articles.length && Date.now() < deadline) {
        const article = articles[next++];
        try {
          const remaining = Math.min(NEWS_ARTICLE_TIMEOUT_MS, deadline - Date.now());
          const scraped = await withTimeout(this.scraper.scrape(article.url), remaining);
          if (!scraped?.imageUrl || seen.has(scraped.imageUrl)) continue;
          seen.add(scraped.imageUrl);
          const medium = article.snippet.split(' · ')[0]?.trim() || scraped.siteName;
          found.push({
            url: scraped.imageUrl,
            thumbUrl: scraped.imageUrl,
            credit: `Foto: ${medium}`,
            sourcePageUrl: article.url,
            source: 'news',
            title: article.title,
          });
        } catch {
          // Nota con paywall, bloqueo de bots, etc.: se salta.
        }
      }
    };
    await withTimeout(Promise.all(Array.from({ length: NEWS_CONCURRENCY }, worker)), NEWS_DEADLINE_MS + 1_000);
    const result = [...found];
    // Vacío casi siempre es un tropiezo pasajero (bloqueo, timeout): no se guarda.
    if (result.length > 0) this.newsCache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  }
}
