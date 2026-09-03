// Puente entre AutomationRunnerService (apps/api, proceso Node normal) y este
// paquete (ESM puro, sin build — solo se ejecuta bien vía tsx/bundler, ver
// comentario en package.json). En vez de importar render.ts directo desde el
// API (rompe en runtime: Node nativo no resuelve imports relativos de un
// paquete "type":"module" sin un paso de build real), el runner lo invoca
// como subproceso — igual que ya hace Task Scheduler con `tsx src/index.ts`
// para la corrida diaria.
// stdin: JSON de qué categorías del CMS pertenecen a qué sitio real
// ({categorySlug: sites[]}, ver AutomationRunnerService.buildSlugToSites) —
// este script cruza eso con SiteConfig.categories (que sí conoce
// cmsCategorySlugs) para armar el categorySiteMap completo, mismo criterio
// que buildCategorySiteMap() en apps/cms/src/app/content-radar/page.tsx.
// stdout: JSON { fileName, topics }.
import { listReports, readReportFile, extractTopics, extractSearchPhrases } from "./render.js";
import { DEFAULT_SITE_ID, getSite } from "./sites.js";

async function main() {
  let input = "";
  for await (const chunk of process.stdin) input += chunk;
  const slugToSites = input.trim() ? (JSON.parse(input) as Record<string, string[]>) : {};

  const categorySiteMap = new Map<string, Set<string>>();
  for (const category of getSite(DEFAULT_SITE_ID).categories) {
    const sites = new Set<string>();
    for (const slug of category.cmsCategorySlugs ?? []) {
      for (const site of slugToSites[slug] ?? []) sites.add(site);
    }
    if (sites.size > 0) categorySiteMap.set(category.label, sites);
  }

  const files = await listReports(DEFAULT_SITE_ID);
  const fileName = files[0];
  if (!fileName) {
    process.stdout.write(JSON.stringify({ fileName: null, topics: [], searchPhrases: [] }));
    return;
  }

  const raw = await readReportFile(fileName);
  const topics = await extractTopics(raw, categorySiteMap as never);
  const searchPhrases = extractSearchPhrases(raw);
  process.stdout.write(JSON.stringify({ fileName, topics, searchPhrases }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
