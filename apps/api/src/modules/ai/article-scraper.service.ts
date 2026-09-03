import { Injectable, Logger } from '@nestjs/common';
import { chromium } from 'playwright';
// jsdom carga (transitivamente) un paquete ESM-only que Node no puede
// require() — en local no importa, pero en el runtime serverless de Vercel
// esto tronaba el arranque de TODO el API con ERR_REQUIRE_ESM, aunque nadie
// hubiera llamado a scrape() todavía (Nest resuelve todos los imports al
// bootstrear). import() dinámico dentro de extract() difiere esa carga
// hasta el primer scrape real, sin bloquear el arranque.
import type { JSDOM as JSDOMType } from 'jsdom';
import type { Readability as ReadabilityType } from '@mozilla/readability';

export interface ScrapedArticle {
  text: string;
  imageUrl?: string;
  // Otras imágenes reales dentro del cuerpo del artículo (además del
  // og:image) — candidatas extra para el picker de imágenes del CMS, con el
  // mismo crédito que la principal (misma fuente citada). Tope de 5, sin
  // garantía de que existan — muchos artículos solo traen una imagen.
  additionalImageUrls: string[];
  // Nombre de la fuente para créditos automáticos cuando se pide "solo la
  // imagen" de una URL cualquiera (ver AiDraftService.fetchImageFromUrl) —
  // og:site_name si el sitio lo declara, si no el hostname sin "www.".
  // Siempre presente (a diferencia de imageUrl): sirve como crédito aunque
  // el sitio no traiga imagen.
  siteName: string;
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

      await page.goto(url, {
        waitUntil: 'domcontentloaded',
        timeout: NAV_TIMEOUT_MS,
      });
      // Google News resuelve con JS después del load inicial — un pequeño margen
      // extra para que termine de navegar a la nota real antes de leer la URL.
      await page
        .waitForLoadState('networkidle', { timeout: NAV_TIMEOUT_MS })
        .catch(() => undefined);

      const finalUrl = page.url();
      const html = await page.content();
      await browser.close();
      browser = null;

      return await this.extract(html, finalUrl);
    } catch (err) {
      this.logger.warn(
        `No se pudo scrapear "${url}": ${(err as Error).message}`,
      );
      return null;
    } finally {
      if (browser) await browser.close().catch(() => undefined);
    }
  }

  private async extract(html: string, url: string): Promise<ScrapedArticle | null> {
    const { JSDOM }: { JSDOM: typeof JSDOMType } = await import('jsdom');
    const { Readability }: { Readability: typeof ReadabilityType } = await import('@mozilla/readability');
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    const text = article?.textContent?.trim();
    // Menos de esto casi siempre es una página de error/paywall/interstitial,
    // no un artículo real — mejor caer al fallback que mandarle basura a la IA.
    if (!text || text.length < 200) return null;

    const imageUrl = this.extractOgImage(dom.window.document);
    const additionalImageUrls = this.extractBodyImages(
      article?.content ?? '',
      url,
      imageUrl,
    );
    const siteName = this.extractSiteName(dom.window.document, url);
    return {
      text: text.slice(0, MAX_ARTICLE_CHARS),
      imageUrl,
      additionalImageUrls,
      siteName,
    };
  }

  private extractOgImage(doc: Document): string | undefined {
    const og = doc
      .querySelector('meta[property="og:image"]')
      ?.getAttribute('content');
    return og?.trim() || undefined;
  }

  private extractSiteName(doc: Document, url: string): string {
    const og = doc
      .querySelector('meta[property="og:site_name"]')
      ?.getAttribute('content')
      ?.trim();
    if (og) return og;
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'fuente externa';
    }
  }

  // Imágenes reales dentro del cuerpo ya limpiado por Readability (article.content)
  // — candidatas extra para el picker del CMS además del og:image. Regex simple
  // sobre HTML ya confiable (Readability ya quitó nav/ads/comentarios) en vez de
  // levantar otro DOM completo solo para esto.
  private extractBodyImages(
    contentHtml: string,
    baseUrl: string,
    exclude?: string,
  ): string[] {
    const found: string[] = [];
    for (const match of contentHtml.matchAll(/<img[^>]+src="([^"]+)"/g)) {
      const src = match[1];
      if (!src || src.startsWith('data:')) continue;
      let resolved: string;
      try {
        resolved = new URL(src, baseUrl).toString();
      } catch {
        continue;
      }
      if (resolved === exclude || found.includes(resolved)) continue;
      found.push(resolved);
      if (found.length >= 5) break;
    }
    return found;
  }
}
