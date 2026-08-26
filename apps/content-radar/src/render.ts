import { marked } from "marked";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { REPORTS_DIR } from "./run";
import { HOTTEST_HEADING } from "./report";

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

// Cada sección (## heading + su contenido hasta el siguiente ##) se envuelve en una
// tarjeta con borde, para que el reporte se vea como paneles en vez de texto corrido.
// data-slug (leído del id del propio h2) es lo que usa el filtro de la barra de chips.
function wrapSectionsInCards(html: string): string {
  return html
    .split(/(?=<h2 )/)
    .map((part) => {
      if (!part.trim().startsWith("<h2")) return part;
      const idMatch = part.match(/<h2 id="([^"]+)"/);
      const slug = idMatch ? idMatch[1] : "";
      const hotClass = slug === slugify(HOTTEST_HEADING) ? " card-hot" : "";
      return `<section class="card${hotClass}" data-slug="${slug}">${part}</section>`;
    })
    .join("");
}

// Barra de saltos rápidos por categoría, construida a partir de qué secciones
// realmente aparecen en este reporte (buildMarkdownReport solo emite las que tienen temas).
// Escanea directo el markdown por cualquier `## Título \`(N)\`` — no una lista fija
// de labels conocidos, porque secciones como "Otros — Nacional — <estado>" son
// dinámicas (32 estados posibles, se generan solo los que sí traen algo ese día).
export function categoryNav(rawMarkdown: string): string {
  const headingRe = /^## (.+?) `\((\d+)\)`$/gm;
  const chips: string[] = [];
  for (const match of rawMarkdown.matchAll(headingRe)) {
    const label = match[1];
    const count = match[2];
    const slug = slugify(label);
    chips.push(`<a class="chip" href="#${slug}" data-slug="${slug}">${escapeHtml(label)} <span>${count}</span></a>`);
  }

  if (chips.length === 0) return "";
  return `
    <div class="filters-bar">
      <nav class="category-nav">
        <button type="button" class="chip chip-all active" data-slug="__all__">Todos</button>
        ${chips.join("")}
      </nav>
      <p class="filter-status" hidden></p>
    </div>
  `;
}

export interface RenderedReport {
  navHtml: string;
  articleHtml: string;
}

// Punto de entrada único: markdown crudo del reporte -> HTML listo para
// inyectar en la página (nav de chips + artículo con tarjetas/botones).
export async function renderReport(rawMarkdown: string): Promise<RenderedReport> {
  const parsed = (await marked.parse(rawMarkdown)).replace(/<h1>.*?<\/h1>/, "");
  const articleHtml = wrapSectionsInCards(
    injectItemPublishButtons(injectPublishButtons(wrapRankedHeadings(addHeadingAnchors(parsed)))),
  );
  const navHtml = categoryNav(rawMarkdown);
  return { navHtml, articleHtml };
}

export async function readReportFile(fileName: string): Promise<string> {
  if (!/^[\w-]+\.md$/.test(fileName)) {
    throw new Error(`Nombre de reporte inválido: "${fileName}".`);
  }
  return readFile(path.join(REPORTS_DIR, fileName), "utf-8");
}
