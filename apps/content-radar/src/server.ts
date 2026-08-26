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
const FILE_NAME_RE = /^[\w-]+\.md$/;

const app = express();
app.use(express.urlencoded({ extended: false }));
// El contenido cambia cada vez que le das "Actualizar ahora" sobre la misma URL —
// sin esto el navegador puede seguir mostrando una versión vieja cacheada.
app.use((_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});

app.get("/", (_req, res) => {
  res.redirect(`/s/${DEFAULT_SITE_ID}`);
});

// Compat con URLs de antes del multi-sitio (todo era implícitamente la-mira).
app.get("/reporte/:file", (req, res) => {
  res.redirect(`/s/${DEFAULT_SITE_ID}/reporte/${req.params.file}`);
});

app.get("/s/:siteId", async (req, res) => {
  const site = requireSite(req.params.siteId, res);
  if (!site) return;

  const files = await listReports(site.id);
  const latest = files[0];
  if (!latest) {
    res.send(layout(site, sidebar(site, files, null), emptyState()));
    return;
  }
  res.redirect(`/s/${site.id}/reporte/${latest}`);
});

app.get("/s/:siteId/reporte/:file", async (req, res) => {
  const site = requireSite(req.params.siteId, res);
  if (!site) return;

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
    const html = wrapSectionsInCards(addHeadingAnchors(parsed));
    const nav = categoryNav(raw);
    const { date, geo } = parseFileName(file, site.id);
    const header = `
      <p class="breadcrumb">Content Radar / <span>${escapeHtml(site.name)}</span></p>
      <h1 class="page-title">${escapeHtml(site.name)} <span class="page-sub">${escapeHtml(date)} · ${escapeHtml(geo)}</span></h1>
    `;
    res.send(
      layout(site, sidebar(site, files, file), `${header}${nav}<article class="report">${html}</article>`)
    );
  } catch {
    res.status(404).send(layout(site, sidebar(site, files, null), `<p>No se encontró ${escapeHtml(file)}.</p>`));
  }
});

app.post("/s/:siteId/actualizar", async (req, res) => {
  const site = requireSite(req.params.siteId, res);
  if (!site) return;

  const geo = typeof req.body?.geo === "string" && req.body.geo.trim() ? req.body.geo.trim() : "MX";
  const { fileName } = await runAndSave(site.id, geo);
  res.redirect(`/s/${site.id}/reporte/${fileName}`);
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
// saltar directo a una categoría desde la barra de navegación.
function addHeadingAnchors(html: string): string {
  return html.replace(/<h2>(.*?)<\/h2>/g, (_match, inner: string) => {
    // El conteo " (N)" varía en cada corrida; se excluye del id para que coincida
    // con el slug del label que generan los chips de categoryNav().
    const plain = inner.replace(/<[^>]+>/g, "").replace(/\s*\(\d+\)\s*$/, "");
    return `<h2 id="${slugify(plain)}">${inner}</h2>`;
  });
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

function sidebar(site: SiteConfig, files: string[], activeFile: string | null): string {
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
        <h1>Content Radar</h1>
        <p class="eyebrow">Temas del día · CDMX</p>
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

function emptyState(): string {
  return `<div class="empty-state"><p>No hay reportes guardados todavía.</p><p>Usa "Actualizar ahora" para generar el primero.</p></div>`;
}

function layout(site: SiteConfig, sidebarHtml: string, mainHtml: string): string {
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
<body>
  <div class="layout">
    ${sidebarHtml}
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
  .brand { margin-bottom: 1.25rem; display: flex; align-items: center; gap: 0.6rem; }
  .brand::before {
    content: "";
    flex: none;
    width: 26px;
    height: 26px;
    border-radius: 7px;
    background: var(--accent);
  }
  .sidebar h1 { font-size: 0.95rem; font-weight: 600; letter-spacing: -0.01em; margin: 0; }
  .eyebrow {
    margin: 0.15rem 0 0;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted-faint);
  }
  .list-label {
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted-faint);
    margin: 1.25rem 0 0.5rem;
    font-family: var(--font-mono);
  }
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
  .refresh-form { display: flex; gap: 0.4rem; margin-bottom: 0.5rem; }
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
    transition: background-color .15s ease, transform .15s ease;
  }
  .refresh-form button:hover { background: var(--accent-hover); transform: translateY(-1px); }
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
  }
  .report-link:hover { background: var(--panel-muted); }
  .report-link.active { background: var(--accent-wash); color: var(--accent-text); font-weight: 600; }
  .geo-badge { font-size: 0.68rem; color: var(--muted); font-family: var(--font-mono); }
  .empty { color: var(--muted); font-size: 0.85rem; }
  .content { flex: 1; padding: 2rem 3rem 4rem; max-width: 900px; min-width: 0; overflow-wrap: break-word; }
  .empty-state { color: var(--muted); }
  .breadcrumb { margin: 0; font-size: 0.78rem; color: var(--muted); }
  .breadcrumb span { color: var(--text); font-weight: 500; }
  .page-title { margin: 0.15rem 0 1.5rem; font-size: 1.4rem; font-weight: 600; letter-spacing: -0.01em; }
  .page-sub { font-family: var(--font-mono); font-size: 0.8rem; font-weight: 400; color: var(--muted); margin-left: 0.6rem; }
  .filters-bar {
    position: sticky;
    top: 0;
    z-index: 20;
    background: var(--bg);
    padding: 0.9rem 0 0.85rem;
    margin-bottom: 1.5rem;
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
  .report > p:first-of-type { color: var(--muted); font-size: 0.85rem; margin: -0.5rem 0 1.5rem; }
  .card {
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 1.25rem 1.5rem 1.5rem;
    margin-bottom: 1.25rem;
    box-shadow: 0 1px 2px rgba(23,20,17,.03);
  }
  .card-hot {
    border-color: var(--amber-border);
    background: linear-gradient(180deg, var(--amber-bg) 0%, var(--panel) 140px);
  }
  .card-hot h2 { color: var(--amber-text); }
  .report h2 {
    margin: 0 0 1rem;
    font-size: 0.7rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
    font-family: var(--font-mono);
  }
  .report h3 {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 1.25rem 0 0.4rem;
    padding-top: 1.1rem;
    border-top: 1px solid var(--border-soft);
  }
  .report h3:first-of-type { padding-top: 0; border-top: none; margin-top: 0; }
  .sub-label {
    margin: 1.1rem 0 0.5rem;
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
  .report ul, .report ol { padding-left: 1.2rem; margin: 0.4rem 0; }
  .report li { margin-bottom: 0.35rem; line-height: 1.45; font-size: 0.88rem; }
  .report ol > li { font-size: 0.9rem; }
  .report a { color: var(--text); text-decoration-color: var(--border); transition: color 0.12s ease, text-decoration-color 0.12s ease; }
  .report a:hover { color: var(--accent-text); text-decoration-color: var(--accent); }
  .report strong { font-weight: 600; }
  .report code {
    font-family: var(--font-mono);
    font-size: 0.78em;
    background: var(--panel-muted);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 0.1em 0.4em;
    color: var(--accent-text);
  }
  .report h2 code {
    background: none;
    border: none;
    padding: 0;
    color: var(--muted);
    font-weight: 500;
  }
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
