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

// Arma el botón "Publicar" para un tema/nota — deep-link a Centro IA con
// `name`/`hints` ya cargados. Nunca fuerza `site`/`type` en la URL, ni
// siquiera para una categoría compartida (La Mira + Planazo): se probó
// mandar 2 botones (uno por sitio) para esas, pero eso saltaba directo al
// formulario de creación de cada sitio (GeneratePlaceFlow, etc.), que pide
// campos con otra redacción ("Nombre del lugar", sin el badge "Desde
// Content Radar") — inconsistente con el formulario único de PublishFlow
// ("Título de la noticia" / "Lo que ya sabes..."). Un solo botón, siempre
// vía PublishFlow, para que la primera pantalla se vea igual sin importar a
// qué sitio termine yendo — Centro IA clasifica sitio+tipo+categoría con IA,
// leyendo el artículo completo (ver AiDraftService.classifyContentType).
// Si `title` ya está en `publishedTitles` (ver ContentRadarPublishedService,
// content-platform/apps/api), el tema ya se publicó — se muestra un badge en
// vez del botón, para no invitar a duplicarlo. `publishedTitles` compara por
// el texto EXACTO del titular (misma llave que ya viajaba en `?name=`), sin
// distinguir mayúsculas/espacios extra por seguridad.
function buildPublishButtons(title: string, hints: string, small: boolean, publishedTitles: Set<string>): string {
  if (publishedTitles.has(normalizeTitle(title))) {
    const cls = small ? "publish-btn publish-btn-sm publish-btn-done" : "publish-btn publish-btn-done";
    return `<span class="${cls}" title="Ya se publicó este tema">✓ Publicado</span>`;
  }
  const base = `/centro-ia?name=${encodeURIComponent(title)}&hints=${encodeURIComponent(hints)}`;
  const cls = small ? "publish-btn publish-btn-sm" : "publish-btn";
  const label = small ? "Publicar" : `Publicar<span aria-hidden="true"> →</span>`;
  const titleAttr = small ? ' title="Publicar sobre esta nota"' : "";
  return `<a class="${cls}" href="${base}" rel="noopener"${titleAttr}>${label}</a>`;
}

// Exportada para que quien arma el Set (content-platform/apps/cms, a partir
// de ContentRadarPublishedService.findAllTitles) normalice con la MISMA
// regla — si no, el `.has()` de arriba nunca hace match.
export function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").toLowerCase();
}

// Botón "Publicar" por tema rankeado — corre DESPUÉS de wrapRankedHeadings
// (opera sobre `<h3><span class="rank">…`) y por sección (ver renderReport),
// no sobre el documento completo, para poder anotar de qué categoría de
// content-radar viene cada tema.
function injectPublishButtons(html: string, categoryLabel: string, publishedTitles: Set<string>): string {
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
        ? `Tema de content-radar: "${title}" (categoría: ${categoryLabel}). Fuente citada: "${linkMatch[2].trim()}" — ${linkMatch[3].trim()} (${linkMatch[1]}).`
        : `Tema de content-radar: "${title}" (categoría: ${categoryLabel}).`;

      const button = buildPublishButtons(title, hints, false, publishedTitles);

      // El texto (rank+título) va envuelto en su propio span para que el botón
      // quede siempre pegado al final de la fila, sin importar qué tan largo
      // sea el título — antes lo seguía en línea y el punto donde caía el
      // botón brincaba de tema a tema, se veía disparejo.
      return `<h3><span class="cr-item-text"><span class="rank">${rank}</span>${titleHtml}</span>${button}</h3>${rest}`;
    })
    .join("");
}

// La mayoría de categorías (Tráfico, Clima, Cultura, etc.) NO tienen un tema
// numerado como "Lo más caliente" — son listas planas de `<li><a>título</a> —
// fuente</li>` (noticias, videos de YouTube). Cada una de esas notas gana su
// propio botón Publicar chiquito, mismo destino (Centro IA) que el de los
// temas rankeados, pero usando el título de la nota en vez del título del tema.
// Corre DESPUÉS de injectPublishButtons así que no toca los <h3> ya armados.
function injectItemPublishButtons(html: string, categoryLabel: string, publishedTitles: Set<string>): string {
  return html.replace(
    // El 4to grupo (opcional) es el badge de alcaldía/municipio que agrega
    // itemGeoBadge en report.ts (ver geo.ts) — sin capturarlo aparte, el
    // <span class="geo-tag"> que trae adentro rompía este match porque el
    // regex exigía que "</li>" viniera pegado justo después de la fuente.
    /<li><a href="([^"]+)">([^<]+)<\/a>\s*—\s*([^<]+?)(<span class="geo-tag">[^<]*<\/span>)?<\/li>/g,
    (match, url: string, title: string, source: string, geoBadge = "") => {
      const hints = `Fuente de content-radar: "${title}" — ${source} (${url}). Categoría de content-radar: ${categoryLabel}.`;
      const button = buildPublishButtons(title, hints, true, publishedTitles);
      // Mismo motivo que en injectPublishButtons: el título+fuente va en su
      // propio span para que el botón quede fijo al final de la fila en vez
      // de perseguir el largo variable del texto.
      return `<li><span class="cr-item-text"><a href="${url}">${title}</a> — ${source}${geoBadge}</span>${button}</li>`;
    },
  );
}

// "Lo más caliente" no es una categoría más — es el resumen cross-categoría,
// el punto de entrada real del reporte, por eso vive en su propia sección
// ("Radar del día") en vez de mezclarse con las categorías de abajo. Pero el
// formato de cada tema es EL MISMO acordeón que usa cada categoría (ver
// buildRow/.cr-row) — antes eran tarjetas ámbar siempre expandidas en
// cuadrícula, ahora es la misma lista vertical colapsable, mismo look. El
// <h3> (rank+título+Publicar, ya armado por wrapRankedHeadings/injectPublishButtons)
// queda siempre visible como resumen; el resto (volumen, tags, fuente citada)
// se colapsa.
function buildHeroTiles(sectionBody: string): string {
  const tiles = sectionBody
    .split(/(?=<h3>)/)
    .filter((part) => part.trim().startsWith("<h3>"))
    .map((part) => {
      const h3Match = part.match(/^<h3>[\s\S]*?<\/h3>/);
      if (!h3Match) return `<details class="cr-row"><summary class="cr-row-summary">${part}${CHEVRON_ICON}</summary></details>`;
      const header = h3Match[0];
      const body = part.slice(header.length);
      return `
        <details class="cr-row">
          <summary class="cr-row-summary">${header}${CHEVRON_ICON}</summary>
          <div class="cr-row-body">${body}</div>
        </details>
      `;
    })
    .join("");
  if (!tiles) return "";
  return `
    <section class="cr-hero">
      <h2 class="cr-hero-heading">
        Radar del día
        <span class="cr-hero-hint">los temas más calientes ahora mismo, cruzando todas las categorías</span>
      </h2>
      <div class="cr-accordion">${tiles}</div>
    </section>
  `;
}

const CHEVRON_ICON =
  '<svg class="cr-row-chevron" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';

export type CrSite = "la-mira" | "planazo";

// A qué sitio(s) real(es) del CMS corresponde una categoría de content-radar
// (ver SiteCategory.cmsCategorySlugs) — undefined/vacío = sin categoría real
// equivalente (ej. "Noticias Locales"), sin badge. La CMS es quien resuelve
// esto (necesita leer la tabla `categories`); este módulo solo recibe el
// resultado ya calculado, para no acoplar content-radar a esa DB.
export type CategorySiteMap = Map<string, Set<CrSite>>;

const SITE_LABEL: Record<CrSite, string> = { "la-mira": "La Mira", planazo: "Planazo" };

function siteBadgeLabel(sites: Set<CrSite> | undefined): string | undefined {
  if (!sites || sites.size === 0) return undefined;
  if (sites.size === 2) return "Ambos sitios";
  return SITE_LABEL[[...sites][0]];
}

// Una fila colapsable por sección — antes cada categoría era una tarjeta
// gigante siempre expandida (noticias + videos + frases mezclados), había
// que scrollear muchísimo para llegar a algo útil. Colapsada por defecto,
// solo el nombre + conteo son visibles hasta que se hace clic; <details> es
// nativo (sin JS) así que también funciona sin JavaScript.
function buildRow(slug: string, headerInner: string, body: string, muted: boolean, siteBadge?: string): string {
  const badgeHtml = siteBadge
    ? `<span class="cr-row-site-badge${siteBadge === "Ambos sitios" ? " cr-row-site-badge-shared" : ""}">${escapeHtml(siteBadge)}</span>`
    : "";
  return `
    <details class="cr-row${muted ? " cr-row-muted" : ""}" id="${slug}">
      <summary class="cr-row-summary">
        <span class="cr-row-name">${headerInner}${badgeHtml}</span>
        ${CHEVRON_ICON}
      </summary>
      <div class="cr-row-body">${body}</div>
    </details>
  `;
}

export interface AccordionGroup {
  label: string;
  html: string;
}

export interface RenderedReport {
  leadingHtml: string;
  heroHtml: string;
  accordionGroups: AccordionGroup[];
  referenceHtml: string;
}

// Orden fijo de los grupos — el mismo criterio (sitio real) que ya usa el
// badge de cada fila, ahora también estructura la página: antes ~20
// categorías eran una sola lista plana sin más organización que el orden
// alfabético del reporte; agruparlas por a qué sitio corresponden es
// información real que ya se calculaba para el badge, no una categoría
// inventada de más.
const GROUP_ORDER: { key: string; label: string }[] = [
  { key: "shared", label: "Compartidas (La Mira + Planazo)" },
  { key: "la-mira", label: "Exclusivas de La Mira" },
  { key: "planazo", label: "Exclusivas de Planazo" },
  { key: "other", label: "Otras" },
];

function groupKeyFor(sites: Set<CrSite> | undefined): string {
  if (!sites || sites.size === 0) return "other";
  if (sites.size === 2) return "shared";
  return [...sites][0];
}

// Punto de entrada único: markdown crudo del reporte -> HTML listo para
// inyectar en la página, ya separado en los bloques reales de la nueva
// estructura:
//  - leadingHtml: el resumen de una línea al inicio del reporte.
//  - heroHtml: "Lo más caliente", cuadrícula de tarjetas (ver buildHeroTiles).
//  - accordionGroups: categorías del sitio + "Otros — …" como filas
//    colapsables, agrupadas por a qué sitio corresponden (ver GROUP_ORDER) —
//    son las secciones con temas/noticias reales, lo que sí se publica.
//  - referenceHtml: "Qué busca la gente"/"Lo más buscado ahora" — listas de
//    referencia (frases/términos sin fuente citable), separadas de las
//    categorías porque no son un tema del que se pueda publicar directo.
// `categorySiteMap`: opcional — a qué sitio(s) real(es) corresponde cada
// categoría (clave = SiteCategory.label, ver CategorySiteMap arriba). Lo
// calcula la página del CMS (única con acceso a la tabla `categories`) y se
// lo pasa a este módulo, que se queda sin conocer la DB. Sin este parámetro,
// todo cae en el grupo "Otras" (sin badge, como antes).
export async function renderReport(rawMarkdown: string, categorySiteMap?: CategorySiteMap, publishedTitles: Set<string> = new Set()): Promise<RenderedReport> {
  const parsed = (await marked.parse(rawMarkdown)).replace(/<h1>.*?<\/h1>/, "");
  // wrapRankedHeadings/addHeadingAnchors son formato puro (no arman links) —
  // corren sobre el documento completo. injectPublishButtons/injectItemPublishButtons
  // sí necesitan saber en qué categoría están (para el `publishType` correcto),
  // así que corren MÁS ABAJO, ya por sección, después del split por <h2>.
  const formatted = wrapRankedHeadings(addHeadingAnchors(parsed));

  const headingRe = /^## (.+?) `\((\d+)\)`$/gm;
  const headings = [...rawMarkdown.matchAll(headingRe)].map((m) => ({ label: m[1] }));

  const parts = formatted.split(/(?=<h2 )/);
  const firstIsSection = parts[0]?.trim().startsWith("<h2") ?? false;
  const leadingHtml = firstIsSection ? "" : (parts[0] ?? "");
  const sectionParts = firstIsSection ? parts : parts.slice(1);

  let heroHtml = "";
  const groupedRows = new Map<string, string[]>();
  const referenceRows: string[] = [];

  sectionParts.forEach((part, i) => {
    const heading = headings[i];
    if (!heading) return;
    const h2Match = part.match(/<h2 id="([^"]+)"[^>]*>([\s\S]*?)<\/h2>/);
    const slug = h2Match ? h2Match[1] : slugify(heading.label);
    const headerInner = h2Match ? h2Match[2] : escapeHtml(heading.label);
    const rawBody = h2Match ? part.slice(h2Match[0].length) : part;

    const isReference = heading.label === SEARCH_PHRASES_HEADING || heading.label === TOP_SEARCHES_HEADING;
    // "Lo más caliente" no es una categoría real — sus temas cruzan
    // categorías, así que no hay una sola a la que preguntarle si es
    // compartida (quedan con botón único, Centro IA clasifica sitio+tipo).
    const sites = isReference || heading.label === HOTTEST_HEADING ? undefined : categorySiteMap?.get(heading.label);
    const body = injectItemPublishButtons(injectPublishButtons(rawBody, heading.label, publishedTitles), heading.label, publishedTitles);

    if (heading.label === HOTTEST_HEADING) {
      heroHtml = buildHeroTiles(body);
      return;
    }

    // El conteo (la píldora "17", "22"...) se quita del nombre de las filas de
    // categoría — a simple vista, colapsadas, era el único "badge" visible y
    // no aportaba (el título ya dice de qué se trata; el conteo importa poco
    // sin abrir la fila). Las 2 filas de referencia sí lo conservan.
    const rowLabel = isReference ? headerInner : headerInner.replace(/\s*<span class="count-pill">\d+<\/span>/, "");
    const siteBadge = isReference ? undefined : siteBadgeLabel(sites);
    const row = buildRow(slug, rowLabel, body, isReference, siteBadge);

    if (isReference) {
      referenceRows.push(row);
      return;
    }
    const groupKey = groupKeyFor(sites);
    if (!groupedRows.has(groupKey)) groupedRows.set(groupKey, []);
    groupedRows.get(groupKey)!.push(row);
  });

  const accordionGroups = GROUP_ORDER.map(({ key, label }) => ({ label, html: (groupedRows.get(key) ?? []).join("") })).filter(
    (g) => g.html,
  );

  return {
    leadingHtml,
    heroHtml,
    accordionGroups,
    referenceHtml: referenceRows.join(""),
  };
}

export interface ExtractedTopic {
  title: string;
  hints: string;
  categoryLabel: string;
  sites: CrSite[];
}

// Misma extracción título+hints que injectPublishButtons/injectItemPublishButtons
// (arriba) hacen al armar el botón "Publicar", pero devuelta como datos en vez
// de mutar HTML — la usa el motor de automatización (apps/api) para saber qué
// temas evaluar contra sus reglas, sin tener que journeyar el reporte via HTTP
// ni duplicar la lógica de scoring/relevancia de report.ts. Deliberadamente una
// función aparte de renderReport (no comparten código) para no arriesgar la
// vista HTML ya probada — es la misma regex, aplicada dos veces.
export async function extractTopics(rawMarkdown: string, categorySiteMap?: CategorySiteMap): Promise<ExtractedTopic[]> {
  const parsed = (await marked.parse(rawMarkdown)).replace(/<h1>.*?<\/h1>/, "");
  const formatted = wrapRankedHeadings(addHeadingAnchors(parsed));

  const headingRe = /^## (.+?) `\((\d+)\)`$/gm;
  const headings = [...rawMarkdown.matchAll(headingRe)].map((m) => ({ label: m[1] }));

  const parts = formatted.split(/(?=<h2 )/);
  const firstIsSection = parts[0]?.trim().startsWith("<h2") ?? false;
  const sectionParts = firstIsSection ? parts : parts.slice(1);

  const topics: ExtractedTopic[] = [];

  sectionParts.forEach((part, i) => {
    const heading = headings[i];
    if (!heading) return;
    if (heading.label === SEARCH_PHRASES_HEADING || heading.label === TOP_SEARCHES_HEADING) return;

    const h2Match = part.match(/<h2 id="[^"]+"[^>]*>([\s\S]*?)<\/h2>/);
    const rawBody = h2Match ? part.slice(h2Match[0].length) : part;
    const sites = heading.label === HOTTEST_HEADING ? undefined : categorySiteMap?.get(heading.label);

    // "### N. Título" — temas rankeados (mismo split que injectPublishButtons).
    rawBody
      .split(/(?=<h3><span class="rank">)/)
      .forEach((chunk) => {
        const h3Match = chunk.match(/^<h3><span class="rank">(\d+)<\/span>(.*?)<\/h3>/);
        if (!h3Match) return;
        const [full, , titleHtml] = h3Match;
        const title = titleHtml.replace(/<[^>]+>/g, "").trim();
        const rest = chunk.slice(full.length);
        const nextHeadingIdx = rest.search(/<h[23]/);
        const body = nextHeadingIdx === -1 ? rest : rest.slice(0, nextHeadingIdx);
        const linkMatch = body.match(/<a href="([^"]+)">([^<]+)<\/a>\s*—\s*([^<\n]+)/);
        const hints = linkMatch
          ? `Tema de content-radar: "${title}" (categoría: ${heading.label}). Fuente citada: "${linkMatch[2].trim()}" — ${linkMatch[3].trim()} (${linkMatch[1]}).`
          : `Tema de content-radar: "${title}" (categoría: ${heading.label}).`;
        topics.push({ title, hints, categoryLabel: heading.label, sites: sites ? [...sites] : [] });
      });

    // "<li><a>título</a> — fuente</li>" — notas planas (mismo regex que injectItemPublishButtons).
    for (const m of rawBody.matchAll(
      /<li><a href="([^"]+)">([^<]+)<\/a>\s*—\s*([^<]+?)(?:<span class="geo-tag">[^<]*<\/span>)?<\/li>/g,
    )) {
      const [, url, title, source] = m;
      const hints = `Fuente de content-radar: "${title}" — ${source.trim()} (${url}). Categoría de content-radar: ${heading.label}.`;
      topics.push({ title, hints, categoryLabel: heading.label, sites: sites ? [...sites] : [] });
    }
  });

  return topics;
}

// Frases reales de autocompletado de Google ("Qué busca la gente (frases)")
// — a diferencia de extractTopics, esto NO son temas con título/fuente/
// categoría: son la frase de búsqueda tal cual, sin más contexto. Antes se
// excluían a propósito de extractTopics (ver `isReference`/el filtro por
// SEARCH_PHRASES_HEADING arriba) porque no encajaban en ese shape — ahora se
// extraen aparte para que la automatización pueda usarlas como semilla de
// contenido real (sin artículo que citar, la IA redacta directo respondiendo
// la intención de búsqueda). Solo reglas con `includeSearchPhrases` activo
// las reciben — ver AutomationRunnerService.
export function extractSearchPhrases(rawMarkdown: string): string[] {
  const escapedHeading = SEARCH_PHRASES_HEADING.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingRe = new RegExp(`^## ${escapedHeading} \`\\(\\d+\\)\`$`, "m");
  const startMatch = headingRe.exec(rawMarkdown);
  if (!startMatch) return [];
  const rest = rawMarkdown.slice(startMatch.index + startMatch[0].length);
  const nextHeadingIdx = rest.search(/\n## /);
  const section = nextHeadingIdx === -1 ? rest : rest.slice(0, nextHeadingIdx);
  return section
    .split("\n")
    .map((line) => line.match(/^- (.+)$/)?.[1]?.trim())
    .filter((p): p is string => !!p);
}

export async function readReportFile(fileName: string): Promise<string> {
  if (!/^[\w-]+\.md$/.test(fileName)) {
    throw new Error(`Nombre de reporte inválido: "${fileName}".`);
  }
  return readFile(path.join(REPORTS_DIR, fileName), "utf-8");
}
