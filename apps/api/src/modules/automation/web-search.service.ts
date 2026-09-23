import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

const RESULT_LIMIT = 6;
const FETCH_TIMEOUT_MS = 8_000;

// Notas reales por frase/lugar usando el feed público de Google News (RSS) —
// el humano elige una como fuente citada antes de generar contenido (ver
// SearchPhrasesService / LocalSearchService), nunca se le pide a la IA que
// redacte a ciegas sin nada que citar. Mismo principio que ImageSearchService:
// el crédito/fuente siempre viene de un resultado real.
//
// Se dejó de usar Custom Search JSON API (Google Programmable Search): requería
// key + engine id en un proyecto de Google Cloud con la API habilitada, y en la
// práctica chocaba con la gobernanza de la cuenta (proyecto equivocado, tarjeta,
// políticas). Google News RSS da lo mismo — titulares reales de medios reales de
// CDMX — gratis, sin API key, sin proyecto y sin límite de 100/día. Los links son
// de redirección de Google News: abren la nota real en el navegador al hacer clic.
@Injectable()
export class WebSearchService {
  private readonly logger = new Logger(WebSearchService.name);

  constructor(private readonly config: ConfigService) {}

  // Google News RSS no necesita configuración — siempre disponible. Se conserva
  // el método porque otras piezas históricamente preguntaban por él.
  isConfigured(): boolean {
    return true;
  }

  async search(query: string): Promise<WebSearchResult[]> {
    const url =
      'https://news.google.com/rss/search?' +
      new URLSearchParams({
        q: query,
        hl: 'es-419',
        gl: 'MX',
        ceid: 'MX:es-419',
      }).toString();

    try {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; content-platform/1.0)' },
      });
      if (!res.ok) {
        this.logger.warn(`Google News RSS falló para "${query}": HTTP ${res.status}`);
        return [];
      }
      const xml = await res.text();
      return this.parseRss(xml).slice(0, RESULT_LIMIT);
    } catch (err) {
      this.logger.warn(`Google News RSS falló para "${query}": ${(err as Error).message}`);
      return [];
    }
  }

  private parseRss(xml: string): WebSearchResult[] {
    const results: WebSearchResult[] = [];
    // Cada nota es un <item>…</item>. Regex simple en vez de una librería XML:
    // el shape del feed de Google News es estable y controlado, no HTML arbitrario.
    const itemRe = /<item>([\s\S]*?)<\/item>/g;
    let match: RegExpExecArray | null;
    while ((match = itemRe.exec(xml)) !== null) {
      const block = match[1];
      const rawTitle = this.tag(block, 'title');
      const link = this.tag(block, 'link');
      if (!rawTitle || !link) continue;

      // <source url="…">MEDIO</source> trae el nombre real del medio; el title
      // viene como "Titular - MEDIO", así que se le quita ese sufijo para dejar
      // el titular limpio y el medio se guarda aparte en el snippet.
      const source = this.decode((block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1] ?? '').trim());
      let title = this.decode(rawTitle);
      if (source && title.endsWith(` - ${source}`)) {
        title = title.slice(0, -(source.length + 3)).trim();
      }

      const dateLabel = this.formatDate(this.tag(block, 'pubDate'));
      const snippet = [source, dateLabel].filter(Boolean).join(' · ');

      results.push({ title, url: this.decode(link).trim(), snippet });
    }
    return results;
  }

  private tag(block: string, name: string): string | null {
    const m = block.match(new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`));
    return m ? m[1] : null;
  }

  private formatDate(pubDate: string | null): string {
    if (!pubDate) return '';
    const d = new Date(pubDate);
    if (Number.isNaN(d.getTime())) return '';
    try {
      return new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' }).format(d);
    } catch {
      return '';
    }
  }

  private decode(s: string): string {
    return s
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
      .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)))
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&');
  }
}
