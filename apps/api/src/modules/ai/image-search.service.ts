import { Injectable, Logger } from '@nestjs/common';

export interface ImageSearchResult {
  url: string;
  thumbUrl: string;
  credit: string;
  sourcePageUrl: string;
  source: 'wikimedia' | 'openverse';
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
// siempre viene de una fuente real, nunca inventado). Dos fuentes, ninguna
// pide API key: Wikimedia Commons (licencia+autor estructurados en
// extmetadata) y Openverse (agrega Flickr y otros bancos CC, se filtra a
// `license_type=commercial` — excluye NC, que no es seguro para un sitio con
// anuncios reales).
@Injectable()
export class ImageSearchService {
  private readonly logger = new Logger(ImageSearchService.name);

  async search(query: string): Promise<ImageSearchResult[]> {
    const [wikimedia, openverse] = await Promise.all([this.searchWikimedia(query), this.searchOpenverse(query)]);
    return [...wikimedia, ...openverse];
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
        .filter((x): x is { info: WikimediaImageInfo } => !!x && !!x.info.mime?.startsWith('image/') && !!x.info.thumburl)
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
}
