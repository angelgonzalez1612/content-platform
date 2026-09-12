import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ImageSearchResult {
  url: string;
  thumbUrl: string;
  credit: string;
  sourcePageUrl: string;
  source: 'wikimedia' | 'openverse' | 'bing';
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

interface BingImageResult {
  contentUrl: string;
  thumbnailUrl?: string;
  hostPageUrl?: string;
  hostPageDomainFriendlyName?: string;
  encodingFormat?: string;
}

const RESULT_LIMIT_PER_SOURCE = 9;
const FETCH_TIMEOUT_MS = 8_000;

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Búsqueda de imágenes de uso libre para adjuntar a un borrador — no las
// genera/inventa la IA, es el humano quien elige de una lista real de
// resultados (mismo principio que la imagen scrapeada de Fase 4: el crédito
// siempre viene de una fuente real, nunca inventado). Wikimedia Commons y
// Openverse no piden API key y traen licencia+autor estructurados; Bing
// Image Search (tercera fuente, opcional — solo si hay BING_API_KEY) es más
// amplio pero NO da autor real por imagen, solo el sitio de origen — se
// filtra a `license=ShareCommercially` (lo más seguro que ofrece Bing para
// un sitio con anuncios reales) y el crédito queda como "Fuente: <dominio>",
// honesto sobre lo que sí se sabe, sin inventar un fotógrafo.
@Injectable()
export class ImageSearchService {
  private readonly logger = new Logger(ImageSearchService.name);

  constructor(private readonly config: ConfigService) {}

  async search(query: string): Promise<ImageSearchResult[]> {
    const [wikimedia, openverse, bing] = await Promise.all([this.searchWikimedia(query), this.searchOpenverse(query), this.searchBing(query)]);
    return [...wikimedia, ...openverse, ...bing];
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

  async searchBing(query: string): Promise<ImageSearchResult[]> {
    const apiKey = this.config.get<string>('BING_API_KEY');
    if (!apiKey) return [];

    const url =
      'https://api.bing.microsoft.com/v7.0/images/search?' +
      new URLSearchParams({
        q: query,
        count: String(RESULT_LIMIT_PER_SOURCE),
        safeSearch: 'Strict',
        // Lo más restrictivo que ofrece Bing sigue permitiendo uso comercial
        // sin más filtro — necesario para un sitio con anuncios reales.
        license: 'ShareCommercially',
      }).toString();

    try {
      const res = await fetch(url, {
        headers: { 'Ocp-Apim-Subscription-Key': apiKey },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) return [];
      const data = (await res.json()) as { value?: BingImageResult[] };
      return (data.value ?? [])
        .filter((r) => r.contentUrl && r.thumbnailUrl)
        .map((r) => ({
          url: r.contentUrl,
          thumbUrl: r.thumbnailUrl!,
          // Bing no da autor/licencia estructurados por imagen como
          // Wikimedia — el crédito honesto que sí se puede dar es el sitio
          // de origen, nunca un autor inventado.
          credit: `Fuente: ${r.hostPageDomainFriendlyName ?? new URL(r.hostPageUrl ?? r.contentUrl).hostname} (Bing)`,
          sourcePageUrl: r.hostPageUrl ?? r.contentUrl,
          source: 'bing' as const,
        }))
        .slice(0, RESULT_LIMIT_PER_SOURCE);
    } catch (err) {
      this.logger.warn(`Búsqueda en Bing falló para "${query}": ${(err as Error).message}`);
      return [];
    }
  }
}
