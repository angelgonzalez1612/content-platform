import { Injectable, Logger } from '@nestjs/common';

export interface ImageSearchResult {
  url: string;
  thumbUrl: string;
  credit: string;
  sourcePageUrl: string;
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

const RESULT_LIMIT = 9;
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
// siempre viene de una fuente real, nunca inventado). Wikimedia Commons
// se eligió porque su API no requiere API key y ya trae licencia+autor
// estructurados (extmetadata) — a diferencia de la mayoría de bancos de
// imágenes "gratuitos", que sí piden key o no traen licencia clara.
@Injectable()
export class ImageSearchService {
  private readonly logger = new Logger(ImageSearchService.name);

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
          };
        })
        .slice(0, RESULT_LIMIT);
    } catch (err) {
      this.logger.warn(`Búsqueda de imágenes falló para "${query}": ${(err as Error).message}`);
      return [];
    }
  }
}
