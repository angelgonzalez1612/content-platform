import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';
import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';

export interface ScrapedArticle {
  text: string;
  imageUrl?: string;
}

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const FETCH_TIMEOUT_MS = 10_000;
const NAV_TIMEOUT_MS = 12_000;
// Tope de caracteres del artículo que se manda al prompt — un artículo completo
// real rara vez pasa de esto; existe solo para no reventar el contexto del
// modelo si algo raro se extrae (ej. una página que no era realmente el artículo).
const MAX_ARTICLE_CHARS = 8_000;

// Lee el artículo COMPLETO de la fuente citada por content-radar (Fase 2 del
// plan de rediseño del pipeline) en vez de mandarle a la IA solo un titular —
// da material real para que redacte de forma independiente, no una paráfrasis
// de una sola oración. Nunca debe bloquear el flujo de Publicar: cualquier
// falla (sitio caído, paywall, bloqueo de bots, formato inesperado) devuelve
// `null` y el caller cae al comportamiento de antes (solo título+fuente).
//
// Los links de "Google News CDMX" (la fuente de la mayoría de las categorías)
// NO redirigen por HTTP al artículo real — Google los resuelve con JavaScript
// en el navegador (se verificó en vivo: un fetch/curl normal solo aterriza en
// una página intermedia de news.google.com con un token opaco, no la URL real).
// Por eso esto usa un navegador headless real (Playwright) en vez de un fetch
// simple — deja que la redirección de JS ocurra de verdad y lee `page.url()`
// después. Las fuentes RSS directas (La Jornada, El Financiero) ya dan la URL
// real desde content-radar, pero pasan por el mismo camino para no duplicar
// lógica — el costo extra de abrir un navegador para esas es aceptable porque
// esto corre una sola vez por clic en "Publicar", no por cada nota del reporte.
@Injectable()
export class ArticleScraperService {
  private readonly logger = new Logger(ArticleScraperService.name);

  async scrape(url: string): Promise<ScrapedArticle | null> {
    let browser: import('playwright').Browser | null = null;
    try {
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage({ userAgent: USER_AGENT });
      page.setDefaultTimeout(FETCH_TIMEOUT_MS);

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
      // Google News resuelve con JS después del load inicial — un pequeño margen
      // extra para que termine de navegar a la nota real antes de leer la URL.
      await page.waitForLoadState('networkidle', { timeout: NAV_TIMEOUT_MS }).catch(() => undefined);

      const finalUrl = page.url();
      const html = await page.content();
      await browser.close();
      browser = null;

      return this.extract(html, finalUrl);
    } catch (err) {
      this.logger.warn(`No se pudo scrapear "${url}": ${(err as Error).message}`);
      return null;
    } finally {
      if (browser) await browser.close().catch(() => undefined);
    }
  }

  private extract(html: string, url: string): ScrapedArticle | null {
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    const text = article?.textContent?.trim();
    // Menos de esto casi siempre es una página de error/paywall/interstitial,
    // no un artículo real — mejor caer al fallback que mandarle basura a la IA.
    if (!text || text.length < 200) return null;

    const imageUrl = this.extractOgImage(dom.window.document);
    return { text: text.slice(0, MAX_ARTICLE_CHARS), imageUrl };
  }

  private extractOgImage(doc: Document): string | undefined {
    const og = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');
    return og?.trim() || undefined;
  }
}
