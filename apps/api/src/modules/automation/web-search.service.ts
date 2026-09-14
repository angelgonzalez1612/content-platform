import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface GoogleSearchItem {
  title?: string;
  link?: string;
  snippet?: string;
}

const RESULT_LIMIT = 6;
const FETCH_TIMEOUT_MS = 8_000;

// Ligas reales por cada frase de "Qué busca la gente" (Google Programmable
// Search / Custom Search JSON API) — el humano elige una como fuente citada
// antes de generar contenido (ver SearchPhrasesService), nunca se le pide a
// la IA que redacte a ciegas sin nada que citar. Mismo principio que
// ImageSearchService: el crédito/fuente siempre viene de un resultado real.
@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!(this.config.get('GOOGLE_SEARCH_API_KEY') && this.config.get('GOOGLE_SEARCH_ENGINE_ID'));
  }

  async search(query: string): Promise<WebSearchResult[]> {
    if (!this.isConfigured()) {
      throw new InternalServerErrorException(
        'La búsqueda web no está configurada (faltan GOOGLE_SEARCH_API_KEY/GOOGLE_SEARCH_ENGINE_ID) — pídele al administrador que las agregue en Vercel.',
      );
    }

    const url =
      'https://www.googleapis.com/customsearch/v1?' +
      new URLSearchParams({
        key: this.config.get<string>('GOOGLE_SEARCH_API_KEY')!,
        cx: this.config.get<string>('GOOGLE_SEARCH_ENGINE_ID')!,
        q: query,
        num: String(RESULT_LIMIT),
        gl: 'mx',
        hl: 'es',
      }).toString();

    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
      if (!res.ok) {
        this.logger.warn(`Búsqueda web falló para "${query}": HTTP ${res.status}`);
        return [];
      }
      const data = (await res.json()) as { items?: GoogleSearchItem[] };
      return (data.items ?? [])
        .filter((item) => item.link && item.title)
        .map((item) => ({ title: item.title!, url: item.link!, snippet: item.snippet ?? '' }));
    } catch (err) {
      this.logger.warn(`Búsqueda web falló para "${query}": ${(err as Error).message}`);
      return [];
    }
  }
}
