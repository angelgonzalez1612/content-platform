import { marked } from "marked";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { REPORTS_DIR } from "./run";
import { HOTTEST_HEADING, SEARCH_PHRASES_HEADING, TOP_SEARCHES_HEADING } from "./report";

// Todo lo que convierte un reporte .md de content-radar en HTML interactivo
// (temas rankeados, botones Publicar, tarjetas por categoría, chips de
// filtro) vivía como funciones privadas de un server Express aparte
// (apps/content-radar antes tenía su propio viewer en el puerto 4310). Ahora
// content-platform/apps/cms importa este módulo directo — misma consola, sin
// un segundo proceso/proyecto detrás de un iframe.

export async function listReports(siteId: string): Promise<string[]> {
  try {
    const entries = await readdir(REPORTS_DIR);
    return entries
      .filter((f) => f.endsWith(`-${siteId}.md`))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function parseFileName(fileName: string, siteId: string): { date: string; geo: string } {
  const suffix = `-${siteId}.md`;
  const base = fileName.endsWith(suffix) ? fileName.slice(0, -suffix.length) : fileName;
  const match = base.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  return match ? { date: match[1], geo: match[2] } : { date: base, geo: "" };
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// marked no agrega ids a los headings por defecto; se los inyectamos para poder
// saltar directo a una categoría desde la barra de navegación. De paso, el
// conteo `(N)` que build-markdown-report.ts pone entre backticks (queda como
// <code>(N)</code>) se convierte en una píldora propia — se ve más a
// "cuántos hay en esta sección" y menos a un dato de código suelto.
function addHeadingAnchors(html: string): string {
  return html.replace(/<h2>(.*?)<\/h2>/g, (_match, inner: string) => {
    // El conteo " (N)" varía en cada corrida; se excluye del id para que coincida
    // con el slug del label que generan los chips de categoryNav().
    const plain = inner.replace(/<[^>]+>/g, "").replace(/\s*\(\d+\)\s*$/, "");
    const withPill = inner.replace(/<code>\((\d+)\)<\/code>/, '<span class="count-pill">$1</span>');
    return `<h2 id="${slugify(plain)}">${withPill}</h2>`;
  });
}

// "### N. Título" (temas rankeados de "Lo más caliente" y de cada categoría) se
// separa en número + título para poder darle al número su propio tratamiento
// visual — aquí sí hay un orden real que importa (posición = qué tan caliente
// está el tema), no es el "01/02/03" decorativo de una landing.
function wrapRankedHeadings(html: string): string {
  return html.replace(/<h3>(\d+)\.\s+(.*?)<\/h3>/g, '<h3><span class="rank">$1</span>$2</h3>');
}

// Botón "Publicar" por tema rankeado — deep-link a Centro IA con el tema y la
// primera fuente citada ya cargados como `name`/`hints`. Corre DESPUÉS de
// wrapRankedHeadings (opera sobre `<h3><span class="rank">…`) y ANTES de
// wrapSectionsInCards (necesita ver dónde empieza el siguiente h2/h3 en el
// HTML plano, que wrapSectionsInCards ya trocea en <section>s separadas).
function injectPublishButtons(html: string): string {
  return html
    .split(/(?=<h3><span class="rank">)/)
    .map((part) => {
      const h3Match = part.match(/^<h3><span class="rank">(\d+)<\/span>(.*?)<\/h3>/);
      if (!h3Match) return part;

      const [full, rank, titleHtml] = h3Match;
      const title = titleHtml.replace(/<[^>]+>/g, "").trim();
      const rest = part.slice(full.length);

      // El cuerpo de ESTE tema es lo que sigue hasta el próximo h2/h3 (o el
      // final del documento) — de ahí se saca la primera fuente citada, si hay.
      const nextHeadingIdx = rest.search(/<h[23]/);
      const body = nextHeadingIdx === -1 ? rest : rest.slice(0, nextHeadingIdx);
      const linkMatch = body.match(/<a href="([^"]+)">([^<]+)<\/a>\s*—\s*([^<\n]+)/);

      const hints = linkMatch
        ? `Tema de content-radar: "${title}". Fuente citada: "${linkMatch[2].trim()}" — ${linkMatch[3].trim()} (${linkMatch[1]}).`
        : `Tema de content-radar: "${title}".`;

      const publishUrl =
        `/centro-ia?site=lamira&type=noticia` +
        `&name=${encodeURIComponent(title)}` +
        `&hints=${encodeURIComponent(hints)}`;
      const button = `<a class="publish-btn" href="${publishUrl}" rel="noopener">Publicar<span aria-hidden="true"> →</span></a>`;

      return `<h3><span class="rank">${rank}</span>${titleHtml}${button}</h3>${rest}`;
    })
    .join("");
}

// La mayoría de categorías (Tráfico, Clima, Cultura, etc.) NO tienen un tema
// numerado como "Lo más caliente" — son listas planas de `<li><a>título</a> —
// fuente</li>` (noticias, videos de YouTube). Cada una de esas notas gana su
// propio botón Publicar chiquito, mismo destino (Centro IA) que el de los
// temas rankeados, pero usando el título de la nota en vez del título del tema.
// Corre DESPUÉS de injectPublishButtons así que no toca los <h3> ya armados.
function injectItemPublishButtons(html: string): string {
  return html.replace(
    /<li><a href="([^"]+)">([^<]+)<\/a>\s*—\s*([^<]+?)<\/li>/g,
    (match, url: string, title: string, source: string) => {
      const hints = `Fuente de content-radar: "${title}" — ${source} (${url}).`;
      const publishUrl =
        `/centro-ia?site=lamira&type=noticia` +
        `&name=${encodeURIComponent(title)}` +
        `&hints=${encodeURIComponent(hints)}`;
      const button = `<a class="publish-btn publish-btn-sm" href="${publishUrl}" rel="noopener" title="Publicar sobre esta nota">Publicar</a>`;
      return `<li><a href="${url}">${title}</a> — ${source}${button}</li>`;
    },
  );
}

// "Lo más caliente" no es una categoría más — es el resumen cross-categoría,
// el punto de entrada real del reporte. En vez de otra tarjeta perdida en la
// lista vertical, sus temas se arman como una cuadrícula de tarjetas grandes
// y escaneables, aparte de todo lo demás. Reutiliza el HTML que ya armaron
// wrapRankedHeadings/injectPublishButtons (rank + título + botón dentro del
// propio <h3>) — solo cambia cómo se agrupan/laydan, no su contenido.
function buildHeroTiles(sectionBody: string): string {
  const tiles = sectionBody
    .split(/(?=<h3>)/)
    .filter((part) => part.trim().startsWith("<h3>"))
    .map((part) => `<article class="cr-hero-tile">${part}</article>`)
    .join("");
  if (!tiles) return "";
  return `
    <section class="cr-hero">
      <h2 class="cr-hero-heading">
        Radar del día
        <span class="cr-hero-hint">los temas más calientes ahora mismo, cruzando todas las categorías</span>
      </h2>
      <div class="cr-hero-grid">${tiles}</div>
    </section>
  `;
}

const CHEVRON_ICON =
  '<svg class="cr-row-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

// Una fila colapsable por sección — antes cada categoría era una tarjeta
// gigante siempre expandida (noticias + videos + frases mezclados), había
// que scrollear muchísimo para llegar a algo útil. Colapsada por defecto,
// solo el nombre + conteo son visibles hasta que se hace clic; <details> es
// nativo (sin JS) así que también funciona sin JavaScript.
function buildRow(slug: string, headerInner: string, body: string, muted: boolean): string {
  return `
    <details class="cr-row${muted ? " cr-row-muted" : ""}" id="${slug}">
      <summary class="cr-row-summary">
        <span class="cr-row-name">${headerInner}</span>
        ${CHEVRON_ICON}
      </summary>
      <div class="cr-row-body">${body}</div>
    </details>
  `;
}

export interface RenderedReport {
  leadingHtml: string;
  jumpNavHtml: string;
  heroHtml: string;
  accordionHtml: string;
  referenceHtml: string;
}

// Punto de entrada único: markdown crudo del reporte -> HTML listo para
// inyectar en la página, ya separado en los bloques reales de la nueva
// estructura:
//  - leadingHtml: el resumen de una línea al inicio del reporte.
//  - heroHtml: "Lo más caliente", cuadrícula de tarjetas (ver buildHeroTiles).
//  - accordionHtml: categorías del sitio + "Otros — …" como filas colapsables
//    — son las secciones con temas/noticias reales, lo que sí se publica.
//  - referenceHtml: "Qué busca la gente"/"Lo más buscado ahora" — listas de
//    referencia (frases/términos sin fuente citable), separadas de las
//    categorías porque no son un tema del que se pueda publicar directo.
export async function renderReport(rawMarkdown: string): Promise<RenderedReport> {
  const parsed = (await marked.parse(rawMarkdown)).replace(/<h1>.*?<\/h1>/, "");
  const transformed = injectItemPublishButtons(injectPublishButtons(wrapRankedHeadings(addHeadingAnchors(parsed))));

  const headingRe = /^## (.+?) `\((\d+)\)`$/gm;
  const headings = [...rawMarkdown.matchAll(headingRe)].map((m) => ({ label: m[1] }));

  const parts = transformed.split(/(?=<h2 )/);
  const firstIsSection = parts[0]?.trim().startsWith("<h2") ?? false;
  const leadingHtml = firstIsSection ? "" : (parts[0] ?? "");
  const sectionParts = firstIsSection ? parts : parts.slice(1);

  let heroHtml = "";
  const jumpChips: string[] = [];
  const accordionRows: string[] = [];
  const referenceRows: string[] = [];

  sectionParts.forEach((part, i) => {
    const heading = headings[i];
    if (!heading) return;
    const h2Match = part.match(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/);
    const slug = h2Match ? h2Match[1] : slugify(heading.label);
    const headerInner = h2Match ? h2Match[2] : escapeHtml(heading.label);
    const body = h2Match ? part.slice(h2Match[0].length) : part;

    if (heading.label === HOTTEST_HEADING) {
      heroHtml = buildHeroTiles(body);
      return;
    }

    const isReference = heading.label === SEARCH_PHRASES_HEADING || heading.label === TOP_SEARCHES_HEADING;
    const row = buildRow(slug, headerInner, body, isReference);
    if (isReference) {
      referenceRows.push(row);
    } else {
      accordionRows.push(row);
      jumpChips.push(`<a class="chip" href="#${slug}">${escapeHtml(heading.label)}</a>`);
    }
  });

  const jumpNavHtml = jumpChips.length === 0 ? "" : `<nav class="cr-jump">${jumpChips.join("")}</nav>`;

  return {
    leadingHtml,
    jumpNavHtml,
    heroHtml,
    accordionHtml: accordionRows.join(""),
    referenceHtml: referenceRows.join(""),
  };
}

export async function readReportFile(fileName: string): Promise<string> {
  if (!/^[\w-]+\.md$/.test(fileName)) {
    throw new Error(`Nombre de reporte inválido: "${fileName}".`);
  }
  return readFile(path.join(REPORTS_DIR, fileName), "utf-8");
}
