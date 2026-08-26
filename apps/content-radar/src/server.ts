try {
  process.loadEnvFile();
} catch {
  // sin .env es válido — YouTube simplemente no aparece en el reporte
}

import express from "express";
import { marked } from "marked";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { REPORTS_DIR, runAndSave } from "./run.js";
import { DEFAULT_SITE_ID, SITES, getSite, type SiteConfig } from "./sites.js";
import { HOTTEST_HEADING } from "./report.js";

const PORT = process.env.PORT ? Number(process.env.PORT) : 4310;
// URL del CMS (apps/cms) — el botón "Publicar" de cada tema apunta ahí, con
// target="_top" para salir del iframe y navegar la ventana completa del CMS.
const CMS_URL = process.env.CMS_URL ?? "http://localhost:3002";
const FILE_NAME_RE = /^[\w-]+\.md$/;

const app = express();
app.use(express.urlencoded({ extended: false }));
// El contenido cambia cada vez que le das "Actualizar ahora" sobre la misma URL —
// sin esto el navegador puede seguir mostrando una versión vieja cacheada.
app.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

// `?embed=1` — puesto por el iframe del CMS (apps/cms/src/app/content-radar) —
// suprime el sidebar propio de content-radar (brand/historial/refrescar) para
// no duplicar la navegación con la del CMS, que ya lo envuelve. Se propaga a
// mano por todos los redirects y por el <form> de "Actualizar" (que es un
// POST, no hereda la query string solo) para que moverse dentro de
// content-radar sin salir del CMS nunca "recupere" el sidebar completo.
function isEmbed(value: unknown): boolean {
  return value === "1" || value === "true";
}
function embedQS(embed: boolean): string {
  return embed ? "?embed=1" : "";
}

app.get("/", (req, res) => {
  res.redirect(`/s/${DEFAULT_SITE_ID}${embedQS(isEmbed(req.query.embed))}`);
});

// Compat con URLs de antes del multi-sitio (todo era implícitamente la-mira).
app.get("/reporte/:file", (req, res) => {
  res.redirect(`/s/${DEFAULT_SITE_ID}/reporte/${req.params.file}${embedQS(isEmbed(req.query.embed))}`);
});

app.get("/s/:siteId", async (req, res) => {
  const site = requireSite(req.params.siteId, res);
  if (!site) return;
  const embed = isEmbed(req.query.embed);

  const files = await listReports(site.id);
  const latest = files[0];
  if (!latest) {
    res.send(layout(site, sidebar(site, files, null, embed), emptyState(), embed));
    return;
  }
  res.redirect(`/s/${site.id}/reporte/${latest}${embedQS(embed)}`);
});

app.get("/s/:siteId/reporte/:file", async (req, res) => {
  const site = requireSite(req.params.siteId, res);
  if (!site) return;
  const embed = isEmbed(req.query.embed);

  const { file } = req.params;
  if (!FILE_NAME_RE.test(file)) {
    res.status(400).send("Nombre de reporte inválido.");
    return;
  }

  const files = await listReports(site.id);
  try {
    const raw = await readFile(path.join(REPORTS_DIR, file), "utf-8");
    // El h1 de la-mira/planazo se reemplaza por el header propio (breadcrumb + título) de abajo.
    const parsed = (await marked.parse(raw)).replace(/<h1>.*?<\/h1>/, "");
    const html = wrapSectionsInCards(injectPublishButtons(wrapRankedHeadings(addHeadingAnchors(parsed))));
    const nav = categoryNav(raw);
    const { date, geo } = parseFileName(file, site.id);
    const header = `
      <p class="breadcrumb">Content Radar / <span>${escapeHtml(site.name)}</span></p>
      <h1 class="page-title">${escapeHtml(site.name)} <span class="page-sub">${escapeHtml(date)} · ${escapeHtml(geo)}</span></h1>
    `;
    res.send(
      layout(site, sidebar(site, files, file, embed), `${header}${nav}<article class="report">${html}</article>`, embed)
    );
  } catch {
    res.status(404).send(layout(site, sidebar(site, files, null, embed), `<p>No se encontró ${escapeHtml(file)}.</p>`, embed));
  }
});

app.post("/s/:siteId/actualizar", async (req, res) => {
  const site = requireSite(req.params.siteId, res);
  if (!site) return;
  const embed = isEmbed(req.body?.embed);

  const geo = typeof req.body?.geo === "string" && req.body.geo.trim() ? req.body.geo.trim() : "MX";
  const { fileName } = await runAndSave(site.id, geo);
  res.redirect(`/s/${site.id}/reporte/${fileName}${embedQS(embed)}`);
});

function requireSite(siteId: string, res: express.Response): SiteConfig | null {
  try {
    return getSite(siteId);
  } catch {
    res.status(404).send(`Sitio desconocido: "${escapeHtml(siteId)}".`);
    return null;
  }
}

async function listReports(siteId: string): Promise<string[]> {
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

function parseFileName(fileName: string, siteId: string): { date: string; geo: string } {
  const suffix = `-${siteId}.md`;
  const base = fileName.endsWith(suffix) ? fileName.slice(0, -suffix.length) : fileName;
  const match = base.match(/^(\d{4}-\d{2}-\d{2})-(.+)$/);
  return match ? { date: match[1], geo: match[2] } : { date: base, geo: "" };
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
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
// primera fuente citada ya cargados como `name`/`hints`. `target="_top"` para
// que el clic (adentro del iframe embebido en el CMS) navegue la ventana
// completa hacia la pantalla real de creación, no el iframe. Corre DESPUÉS de
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
        `${CMS_URL}/centro-ia?site=lamira&type=noticia` +
        `&name=${encodeURIComponent(title)}` +
        `&hints=${encodeURIComponent(hints)}`;
      const button = `<a class="publish-btn" href="${publishUrl}" target="_top" rel="noopener">Publicar<span aria-hidden="true"> →</span></a>`;

      return `<h3><span class="rank">${rank}</span>${titleHtml}${button}</h3>${rest}`;
    })
    .join("");
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
function categoryNav(rawMarkdown: string): string {
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

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// Con un solo sitio en SITES no hay nada que "cambiar" — el switcher solo tiene
// sentido si algún día se vuelve a agregar un segundo sitio.
function siteSwitcher(activeSiteId: string): string {
  if (Object.keys(SITES).length <= 1) return "";
  const tabs = Object.values(SITES)
    .map((s) => {
      const active = s.id === activeSiteId ? " active" : "";
      return `<a class="site-tab${active}" href="/s/${s.id}">${escapeHtml(s.name)}</a>`;
    })
    .join("");
  return `<div class="site-switcher">${tabs}</div>`;
}

// Solo afecta a "Lo más buscado ahora" (Trending Now) — el resto de las fuentes
// siempre son CDMX/México fijo. México va primero y seleccionado por defecto.
const GEO_OPTIONS: { code: string; flag: string; label: string }[] = [
  { code: "MX", flag: "🇲🇽", label: "México" },
  { code: "US", flag: "🇺🇸", label: "Estados Unidos" },
  { code: "ES", flag: "🇪🇸", label: "España" },
  { code: "AR", flag: "🇦🇷", label: "Argentina" },
  { code: "CO", flag: "🇨🇴", label: "Colombia" },
  { code: "CL", flag: "🇨🇱", label: "Chile" },
  { code: "PE", flag: "🇵🇪", label: "Perú" },
  { code: "BR", flag: "🇧🇷", label: "Brasil" },
];

function geoSelect(): string {
  const options = GEO_OPTIONS.map(
    ({ code, flag, label }) =>
      `<option value="${code}"${code === "MX" ? " selected" : ""}>${flag} ${label}</option>`
  ).join("");
  return `<select name="geo" aria-label="Región (geo)">${options}</select>`;
}

function sidebar(site: SiteConfig, files: string[], activeFile: string | null, embed: boolean): string {
  if (embed) return embedBar(site, files, activeFile);

  const items = files
    .map((f) => {
      const { date, geo } = parseFileName(f, site.id);
      const active = f === activeFile ? " active" : "";
      return `<li><a class="report-link${active}" href="/s/${site.id}/reporte/${f}">${date} <span class="geo-badge">${escapeHtml(geo)}</span></a></li>`;
    })
    .join("");

  return `
    <nav class="sidebar">
      <div class="brand">
        <span class="brand-mark">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="8" />
            <path d="M12 12l4-2.3" />
            <path d="M12 4v2M12 18v2M4 12h2M18 12h2" />
          </svg>
        </span>
        <span>
          <h1>Content Radar</h1>
          <p class="eyebrow">Temas del día · CDMX</p>
        </span>
      </div>
      ${siteSwitcher(site.id)}
      <form method="post" action="/s/${site.id}/actualizar" class="refresh-form">
        ${geoSelect()}
        <button type="submit">Actualizar ahora</button>
      </form>
      <p class="list-label">Reportes</p>
      <ul class="report-list">${items || "<li class=\"empty\">Sin reportes todavía.</li>"}</ul>
    </nav>
  `;
}

// Versión embebida en el CMS (?embed=1, ver isEmbed()) — el CMS YA tiene su
// propio sidebar con "Content Radar" como item, así que repetir el sidebar
// completo de content-radar (marca, historial de reportes) duplicaba la
// navegación en dos menús verticales lado a lado. Esta es una sola barra
// horizontal angosta con lo mínimo indispensable: cambiar de reporte y
// regenerar uno nuevo — el resto (marca, descripción) ya lo pone el CMS.
function embedBar(site: SiteConfig, files: string[], activeFile: string | null): string {
  const options = files
    .map((f) => {
      const { date, geo } = parseFileName(f, site.id);
      const selected = f === activeFile ? " selected" : "";
      return `<option value="/s/${site.id}/reporte/${f}?embed=1"${selected}>${date} · ${escapeHtml(geo)}</option>`;
    })
    .join("");

  return `
    <header class="embed-bar">
      <select
        class="embed-report-select"
        aria-label="Reporte"
        onchange="if (this.value) window.location.href = this.value;"
      >
        ${options || '<option value="">Sin reportes todavía</option>'}
      </select>
      <form method="post" action="/s/${site.id}/actualizar" class="refresh-form embed-refresh-form">
        <input type="hidden" name="embed" value="1" />
        ${geoSelect()}
        <button type="submit">Actualizar</button>
      </form>
    </header>
  `;
}

function emptyState(): string {
  return `<div class="empty-state"><p>No hay reportes guardados todavía.</p><p>Usa "Actualizar ahora" para generar el primero.</p></div>`;
}

function layout(site: SiteConfig, navHtml: string, mainHtml: string, embed: boolean): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Content Radar — ${escapeHtml(site.name)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<style>${STYLES}</style>
</head>
<body class="${embed ? "is-embed" : ""}">
  <div class="layout">
    ${navHtml}
    <main class="content">${mainHtml}</main>
  </div>
  <script>${FILTER_SCRIPT}</script>
</body>
</html>`;
}

// Convierte los chips de #que-busca-la-gente-frases etc. en filtros reales: clic para
// mostrar solo esa(s) categoría(s), clic de nuevo para quitarla, "Todos" resetea.
// Sin JS los chips igual funcionan como ancla (href="#slug") — esto es progressive enhancement.
const FILTER_SCRIPT = `
(function () {
  var nav = document.querySelector(".category-nav");
  var status = document.querySelector(".filter-status");
  if (!nav) return;
  var chips = Array.prototype.slice.call(nav.querySelectorAll(".chip"));
  var allChip = nav.querySelector(".chip-all");
  var cards = Array.prototype.slice.call(document.querySelectorAll(".card[data-slug]"));
  var active = new Set();

  function render() {
    if (active.size === 0) {
      allChip.classList.add("active");
      chips.forEach(function (c) { c.classList.remove("active"); });
      cards.forEach(function (card) { card.hidden = false; });
      status.hidden = true;
    } else {
      allChip.classList.remove("active");
      chips.forEach(function (c) { c.classList.toggle("active", active.has(c.dataset.slug)); });
      cards.forEach(function (card) { card.hidden = !active.has(card.dataset.slug); });
      status.hidden = false;
      status.textContent = "Mostrando " + active.size + " de " + cards.length + " secciones — ";
      var reset = document.createElement("button");
      reset.type = "button";
      reset.className = "filter-reset";
      reset.textContent = "ver todas";
      reset.addEventListener("click", function () { active.clear(); render(); });
      status.appendChild(reset);
    }
  }

  function scrollToCard(slug) {
    var card = document.querySelector('.card[data-slug="' + slug + '"]');
    var bar = document.querySelector(".filters-bar");
    if (!card || !bar) return;
    var barHeight = bar.getBoundingClientRect().height;
    var top = card.getBoundingClientRect().top + window.scrollY - barHeight - 16;
    window.scrollTo({ top: top, behavior: "smooth" });
  }

  allChip.addEventListener("click", function () {
    active.clear();
    render();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  chips.forEach(function (chip) {
    chip.addEventListener("click", function (e) {
      e.preventDefault();
      var slug = chip.dataset.slug;
      var wasActive = active.has(slug);
      if (wasActive) active.delete(slug); else active.add(slug);
      render();
      // Al activar un filtro, saltamos directo a esa tarjeta — no solo se filtra,
      // también te lleva a donde está.
      if (!wasActive) scrollToCard(slug);
    });
  });
})();
`;

// Paleta y tipografía calcadas de content-platform/apps/cms/src/app/globals.css
// (--color-brand, --color-ink, etc.) — content-radar ahora se ve/embebe DENTRO
// del CMS (sidebar "Content Radar"), así que debe sentirse como la misma
// aplicación, no como una herramienta aparte con su propio skin. El CMS es
// de un solo tema (sin dark mode) — se sigue el mismo criterio aquí.
const STYLES = `
  :root {
    --bg: #faf9f7;
    --panel: #ffffff;
    --panel-muted: #f3f0ec;
    --text: #17140f;
    --muted: #7a736c;
    --muted-faint: #a39c95;
    --border: #edeae6;
    --border-soft: #f3f0ec;
    --accent: #fd690d;
    --accent-hover: #e85d06;
    --accent-wash: #fff2e8;
    --accent-text: #c0561a;
    --amber-bg: #fff2e8;
    --amber-text: #c0561a;
    --amber-border: #ffe2cc;
    --green-bg: #eaf7ef;
    --green-text: #2e9e5b;
    --green-border: #cde5d3;
    --font-sans: "Instrument Sans", system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    --font-mono: "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-sans);
    font-size: 14px;
    -webkit-font-smoothing: antialiased;
  }
  @media (prefers-reduced-motion: reduce) {
    * { transition-duration: 0.001ms !important; animation-duration: 0.001ms !important; }
  }

  /* ── layout ──────────────────────────────────────────────────────────── */
  .layout { display: flex; min-height: 100vh; }
  .sidebar {
    width: 264px;
    flex-shrink: 0;
    background: var(--panel);
    border-right: 1px solid var(--border);
    padding: 1.25rem 1rem;
    overflow-y: auto;
    position: sticky;
    top: 0;
    align-self: flex-start;
    height: 100vh;
  }
  .content { flex: 1; padding: 2.25rem clamp(1.5rem, 4vw, 3.25rem) 5rem; max-width: 1040px; min-width: 0; overflow-wrap: break-word; }

  /* ── embed mode (dentro del iframe del CMS, ver isEmbed()) ────────────── */
  /* Sin sidebar propio — una sola barra angosta arriba en vez de un segundo
     menú vertical junto al del CMS. */
  .is-embed .layout { display: block; min-height: 0; }
  .is-embed .content { max-width: none; padding: 1.5rem clamp(1.25rem, 3vw, 2.5rem) 4rem; }
  .embed-bar {
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    flex-wrap: wrap;
    padding: 0.6rem clamp(1.25rem, 3vw, 2.5rem);
    background: var(--panel);
    border-bottom: 1px solid var(--border);
  }
  .embed-report-select {
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel);
    color: var(--text);
    font-family: var(--font-sans);
    font-size: 0.82rem;
  }
  .embed-refresh-form { margin: 0; }

  /* ── sidebar: brand ──────────────────────────────────────────────────── */
  .brand { margin-bottom: 1.5rem; display: flex; align-items: center; gap: 0.65rem; }
  .brand-mark {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 8px;
    background: var(--accent);
    display: grid;
    place-items: center;
    box-shadow: 0 2px 6px -2px rgba(253,105,13,.55);
  }
  .sidebar h1 { font-size: 0.95rem; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
  .eyebrow {
    margin: 0.1rem 0 0;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--muted-faint);
  }
  .list-label {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted-faint);
    margin: 1.5rem 0 0.5rem;
    font-family: var(--font-mono);
  }

  /* ── sidebar: controls ───────────────────────────────────────────────── */
  .site-switcher {
    display: flex;
    gap: 2px;
    padding: 2px;
    margin-bottom: 1rem;
    background: var(--panel-muted);
    border: 1px solid var(--border);
    border-radius: 10px;
  }
  .site-tab {
    flex: 1;
    text-align: center;
    padding: 0.35rem 0.5rem;
    border-radius: 8px;
    text-decoration: none;
    color: var(--muted);
    font-size: 0.78rem;
    font-weight: 500;
  }
  .site-tab.active { background: var(--panel); color: var(--accent-text); font-weight: 600; box-shadow: 0 1px 2px rgba(23,20,17,.06); }
  .refresh-form { display: flex; gap: 0.4rem; }
  .refresh-form select {
    flex-shrink: 0;
    max-width: 7.5rem;
    padding: 0.4rem 0.3rem;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--panel);
    color: var(--text);
    font-family: var(--font-sans);
    font-size: 0.78rem;
  }
  .refresh-form button {
    flex: 1;
    padding: 0.45rem 0.6rem;
    border: none;
    border-radius: 8px;
    background: var(--accent);
    color: #fff;
    cursor: pointer;
    font-size: 0.8rem;
    font-weight: 600;
    font-family: var(--font-sans);
    box-shadow: 0 1px 2px rgba(253,105,13,.35);
    transition: background-color .15s ease, transform .15s ease, box-shadow .15s ease;
  }
  .refresh-form button:hover { background: var(--accent-hover); transform: translateY(-1px); box-shadow: 0 4px 10px -3px rgba(253,105,13,.5); }
  .refresh-form button:active { transform: translateY(0); }

  /* ── sidebar: report history ─────────────────────────────────────────── */
  .report-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.15rem; }
  .report-link {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.45rem 0.6rem;
    border-radius: 8px;
    color: var(--text);
    text-decoration: none;
    font-size: 0.85rem;
    transition: background-color .12s ease;
  }
  .report-link:hover { background: var(--panel-muted); }
  .report-link.active { background: var(--accent-wash); color: var(--accent-text); font-weight: 600; }
  .geo-badge { font-size: 0.68rem; color: var(--muted); font-family: var(--font-mono); }
  .empty { color: var(--muted); font-size: 0.85rem; }
  .empty-state { color: var(--muted); }

  /* ── page header ─────────────────────────────────────────────────────── */
  .breadcrumb { margin: 0; font-size: 0.78rem; color: var(--muted); display: flex; align-items: center; gap: 0.4rem; }
  .breadcrumb::before { content: ""; width: 6px; height: 6px; border-radius: 999px; background: var(--green-text); flex: none; }
  .breadcrumb span { color: var(--text); font-weight: 500; }
  .page-title { margin: 0.3rem 0 1rem; font-size: 1.75rem; font-weight: 600; letter-spacing: -0.02em; text-wrap: balance; }
  .page-sub { font-family: var(--font-mono); font-size: 0.85rem; font-weight: 400; color: var(--muted); margin-left: 0.7rem; vertical-align: middle; }
  .report > p:first-of-type {
    color: var(--muted);
    font-size: 0.84rem;
    margin: -0.35rem 0 2rem;
    padding: 0.55rem 0.85rem;
    background: var(--panel-muted);
    border-radius: 10px;
    display: inline-block;
  }

  /* ── filter chips ────────────────────────────────────────────────────── */
  .filters-bar {
    position: sticky;
    top: 0;
    z-index: 20;
    background: var(--bg);
    padding: 0.9rem 0 0.85rem;
    margin-bottom: 1.75rem;
    border-bottom: 1px solid var(--border);
  }
  .category-nav { display: flex; flex-wrap: wrap; gap: 0.5rem; }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.32rem 0.7rem;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--muted);
    text-decoration: none;
    font-size: 0.78rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    appearance: none;
    transition: border-color 0.12s ease, background 0.12s ease, color 0.12s ease;
  }
  .chip:hover { border-color: var(--amber-border); color: var(--text); }
  .chip.active {
    border-color: var(--amber-border);
    background: var(--amber-bg);
    color: var(--amber-text);
  }
  .chip-all.active { border-color: var(--accent-hover); background: var(--accent); color: #fff; }
  .chip span { font-family: var(--font-mono); color: inherit; opacity: 0.75; font-size: 0.75rem; }
  .filter-status:not([hidden]) {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.78rem;
    color: var(--muted);
    margin-top: 0.65rem;
  }
  .filter-reset {
    border: none;
    background: none;
    padding: 0;
    color: var(--accent-text);
    font-size: 0.78rem;
    font-weight: 600;
    text-decoration: underline;
    cursor: pointer;
    font-family: inherit;
  }

  /* ── section cards ───────────────────────────────────────────────────── */
  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 1.4rem 1.6rem 1.6rem;
    margin-bottom: 1.5rem;
    box-shadow: 0 1px 2px rgba(23,20,17,.03);
    transition: box-shadow .15s ease, border-color .15s ease;
  }
  .card:hover { box-shadow: 0 4px 16px -8px rgba(23,20,17,.1); border-color: var(--border-soft); }
  .card-hot {
    border: 1px solid var(--amber-border);
    border-top: 3px solid var(--accent);
    background: var(--amber-bg);
    padding: 1.6rem 1.75rem 1.75rem;
  }
  .card-hot h2 { color: var(--accent-text); }
  .card-hot .count-pill { background: rgba(253,105,13,.14); color: var(--accent-text); }
  .card-hot .card { box-shadow: none; }

  /* ── headings inside a section ───────────────────────────────────────── */
  .report h2 {
    margin: 0 0 1.1rem;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--text);
    font-family: var(--font-mono);
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }
  .count-pill {
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: normal;
    text-transform: none;
    color: var(--muted);
    background: var(--panel-muted);
    padding: 0.1em 0.55em;
    border-radius: 999px;
  }
  .report h3 {
    display: flex;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.65rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--text);
    margin: 1.5rem 0 0.6rem;
    padding-top: 1.25rem;
    border-top: 1px solid var(--border-soft);
  }
  .report h3:first-of-type { padding-top: 0; border-top: none; margin-top: 0; }
  .rank {
    flex: none;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    font-size: 0.85rem;
    color: var(--muted-faint);
    min-width: 1.3em;
  }
  .card-hot .rank { color: var(--accent); }
  .report h3 a.publish-btn {
    margin-left: auto;
    flex: none;
    align-self: center;
    display: inline-flex;
    align-items: center;
    gap: 0.3rem;
    padding: 0.3rem 0.7rem;
    border-radius: 999px;
    background: var(--accent);
    color: #fff;
    font-family: var(--font-sans);
    font-size: 0.72rem;
    font-weight: 600;
    text-decoration: none;
    white-space: nowrap;
    box-shadow: 0 1px 2px rgba(253,105,13,.3);
    transition: background-color 0.15s ease, transform 0.15s ease;
  }
  .report h3 a.publish-btn:hover { background: var(--accent-hover); color: #fff; transform: translateY(-1px); }
  .report h3 a.publish-btn span { font-family: var(--font-sans); }
  .sub-label {
    margin: 1.35rem 0 0.6rem;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--muted);
    font-family: var(--font-mono);
  }
  .sub-label-hint {
    display: inline-block;
    margin-left: 0.4rem;
    text-transform: none;
    font-weight: 400;
    letter-spacing: normal;
    opacity: 0.8;
  }

  /* ── lists ───────────────────────────────────────────────────────────── */
  .report ul { list-style: none; padding-left: 0; margin: 0.4rem 0; display: flex; flex-direction: column; gap: 0.4rem; }
  .report li { line-height: 1.45; font-size: 0.88rem; color: var(--muted); }
  .report h3 + ul { gap: 0.5rem; }
  .report h3 + ul > li:first-child { display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem; font-size: 0.8rem; }
  .report h3 + ul > li:has(> ul) { font-size: 0.68rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: var(--muted-faint); margin-top: 0.15rem; }
  .report h3 + ul > li:has(> ul) > ul { margin-top: 0.4rem; gap: 0.35rem; }
  .report h3 + ul > li:has(> ul) > ul > li { font-size: 0.85rem; font-weight: 400; text-transform: none; letter-spacing: normal; color: var(--muted); }
  .report ol {
    list-style: none;
    padding-left: 0;
    margin: 0.4rem 0 0;
    counter-reset: rank;
  }
  .report ol > li {
    counter-increment: rank;
    display: flex;
    align-items: baseline;
    gap: 0.7rem;
    padding: 0.55rem 0;
    border-bottom: 1px solid var(--border-soft);
    font-size: 0.9rem;
    color: var(--text);
  }
  .report ol > li::before {
    content: counter(rank);
    flex: none;
    min-width: 1.5em;
    font-family: var(--font-mono);
    font-variant-numeric: tabular-nums;
    font-weight: 700;
    color: var(--muted-faint);
  }
  .report ol > li:last-child { border-bottom: none; }
  .report a { color: var(--text); text-decoration-color: var(--border); text-underline-offset: 2px; transition: color 0.12s ease, text-decoration-color 0.12s ease; }
  .report a:hover { color: var(--accent-text); text-decoration-color: var(--accent); }
  .report strong { font-weight: 600; color: var(--text); }
  .report code {
    font-family: var(--font-mono);
    font-size: 0.78em;
    background: var(--panel-muted);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.1em 0.4em;
    color: var(--accent-text);
  }

  /* ── badges ──────────────────────────────────────────────────────────── */
  .origin-badge {
    display: inline-block;
    font-family: var(--font-mono);
    font-size: 0.68rem;
    font-weight: 600;
    padding: 0.05em 0.45em;
    border-radius: 4px;
    vertical-align: middle;
  }
  .origin-mx { background: var(--green-bg); color: var(--green-text); border: 1px solid var(--green-border); }
  .origin-intl { background: var(--panel-muted); color: var(--muted); border: 1px solid var(--border); }
  .tag {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 500;
    padding: 0.05em 0.5em;
    border-radius: 4px;
    background: var(--panel-muted);
    color: var(--accent-text);
    border: 1px solid var(--border);
    vertical-align: middle;
  }
  .geo-tag {
    display: inline-block;
    font-size: 0.68rem;
    font-weight: 500;
    padding: 0.05em 0.5em;
    border-radius: 4px;
    background: var(--green-bg);
    color: var(--green-text);
    border: 1px solid var(--green-border);
    vertical-align: middle;
  }
`;

app.listen(PORT, () => {
  console.log(`content-radar viewer: http://localhost:${PORT}`);
});
