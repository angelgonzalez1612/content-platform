import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

interface TavilySearchItem {
  title?: string;
  url?: string;
  content?: string;
}

const RESULT_LIMIT = 6;
const FETCH_TIMEOUT_MS = 10_000;

// Ligas reales por cada frase de "Qué busca la gente" (Tavily — buscador
// hecho para que lo consuma una IA, no un humano en un buscador) — el humano
// elige una como fuente citada antes de generar contenido (ver
// SearchPhrasesService), nunca se le pide a la IA que redacte a ciegas sin
// nada que citar. Mismo principio que ImageSearchService: el crédito/fuente
// siempre viene de un resultado real. Se descartó Google Programmable
// Search: dejó de ofrecer "buscar en toda la Web" a cuentas nuevas, un
// buscador creado hoy queda atado a sitios fijos (ver env.ts).
@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);

  constructor(private readonly config: ConfigService) {}

  isConfigured(): boolean {
    return !!this.config.get('TAVILY_API_KEY');
  }

  async search(query: string): Promise<WebSearchResult[]> {
    if (!this.isConfigured()) {
      throw new InternalServerErrorException(
        'La búsqueda web no está configurada (falta TAVILY_API_KEY) — pídele al administrador que la agregue en Vercel.',
      );
    }

    try {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: this.config.get<string>('TAVILY_API_KEY'),
          query,
          search_depth: 'basic',
          max_results: RESULT_LIMIT,
          include_answer: false,
        }),
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!res.ok) {
        this.logger.warn(`Búsqueda web falló para "${query}": HTTP ${res.status}`);
        return [];
      }
      const data = (await res.json()) as { results?: TavilySearchItem[] };
      return (data.results ?? [])
        .filter((item) => item.url && item.title)
        .map((item) => ({ title: item.title!, url: item.url!, snippet: item.content ?? '' }));
    } catch (err) {
      this.logger.warn(`Búsqueda web falló para "${query}": ${(err as Error).message}`);
      return [];
    }
  }
}
