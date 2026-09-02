import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCmsCategories } from "@/lib/cms-api";
import { CmsShell } from "@/components/cms/cms-shell";
import { listReports, parseFileName, readReportFile, renderReport, normalizeTitle, type CategorySiteMap, type CrSite } from "@planazo/content-radar/render";
import { DEFAULT_SITE_ID, getSite } from "@planazo/content-radar/sites";
import { getContentRadarPublishedTitles } from "@/lib/cms-api";
import { refreshContentRadar } from "./actions";
import { ReportPicker } from "./report-picker";
import { GroupSelect } from "./group-select";
import "./content-radar.css";

// A qué sitio real (La Mira/Planazo/ambos) corresponde cada categoría de
// content-radar — se resuelve aquí (única capa con acceso a la tabla real
// `categories`) cruzando SiteCategory.cmsCategorySlugs contra las categorías
// reales de cada sitio, y se le pasa ya resuelto a renderReport (que no
// conoce la DB). Una categoría del CMS aparece en la lista de un sitio si es
// exclusiva de ese sitio O compartida (siteId null) — así que un slug que
// aparece en ambas listas ya es, de por sí, la señal de que es compartida.
async function buildCategorySiteMap(): Promise<CategorySiteMap> {
  const [lamiraCats, planazoCats] = await Promise.all([getCmsCategories("la-mira"), getCmsCategories("planazo")]);
  const slugToSites = new Map<string, Set<CrSite>>();
  for (const [site, cats] of [
    ["la-mira", lamiraCats],
    ["planazo", planazoCats],
  ] as const) {
    for (const c of cats) {
      if (!slugToSites.has(c.slug)) slugToSites.set(c.slug, new Set());
      slugToSites.get(c.slug)!.add(site);
    }
  }

  const map: CategorySiteMap = new Map();
  for (const category of getSite(DEFAULT_SITE_ID).categories) {
    const sites = new Set<CrSite>();
    for (const slug of category.cmsCategorySlugs ?? []) {
      for (const site of slugToSites.get(slug) ?? []) sites.add(site);
    }
    if (sites.size > 0) map.set(category.label, sites);
  }
  return map;
}

// Content Radar vive nativo aquí — antes era un server Express aparte
// (apps/content-radar, puerto 4310) embebido por iframe; ahora esta página
// importa la lógica de @planazo/content-radar como librería y renderiza el
// reporte ella misma. La corrida diaria automática (7am, Task Scheduler)
// sigue siendo el CLI de content-radar sin cambios — esta página solo lee
// los .md que esa corrida ya deja en apps/content-radar/reports.
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

export default async function ContentRadarPage({
  searchParams,
}: {
  searchParams: Promise<{ file?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { file: requestedFile } = await searchParams;
  const files = await listReports(DEFAULT_SITE_ID);
  const activeFile = requestedFile && files.includes(requestedFile) ? requestedFile : files[0];

  const pickerOptions = files.map((f) => {
    const { date, geo } = parseFileName(f, DEFAULT_SITE_ID);
    return { value: `/content-radar?file=${encodeURIComponent(f)}`, label: `${date} · ${geo}` };
  });

  const refreshForm = (
    <form action={refreshContentRadar} className="cr-refresh-form">
      <select name="geo" aria-label="Región (geo)" defaultValue="MX">
        {GEO_OPTIONS.map(({ code, flag, label }) => (
          <option key={code} value={code}>
            {flag} {label}
          </option>
        ))}
      </select>
      <button type="submit">Actualizar</button>
    </form>
  );

  if (!activeFile) {
    return (
      <CmsShell user={session} title="Content Radar">
        <div className="cr-scope">
          <div className="cr-picker cr-picker-end">
            {refreshForm}
          </div>
          <div className="cr-content">
            <div className="cr-empty">
              <p>No hay reportes guardados todavía.</p>
              <p>Usa &quot;Actualizar&quot; para generar el primero.</p>
            </div>
          </div>
        </div>
      </CmsShell>
    );
  }

  const [raw, categorySiteMap, publishedTitlesList] = await Promise.all([
    readReportFile(activeFile),
    buildCategorySiteMap(),
    getContentRadarPublishedTitles(),
  ]);
  const publishedTitles = new Set(publishedTitlesList.map(normalizeTitle));
  const { leadingHtml, heroHtml, accordionGroups, referenceHtml } = await renderReport(raw, categorySiteMap, publishedTitles);

  return (
    <CmsShell user={session} title="Content Radar">
      <div className="cr-scope">
        <div className="cr-picker">
          <ReportPicker options={pickerOptions} value={`/content-radar?file=${encodeURIComponent(activeFile)}`} />
          {refreshForm}
        </div>
        <div className="cr-content report">
          {leadingHtml && <div className="cr-summary" dangerouslySetInnerHTML={{ __html: leadingHtml }} />}
          {heroHtml && <div dangerouslySetInnerHTML={{ __html: heroHtml }} />}
          {/* Antes: una sola lista de ~20 categorías sin más orden que el del
              reporte. Agrupadas por a qué sitio corresponden (mismo dato que
              ya calcula el badge de cada fila), y un <select> muestra solo
              el grupo elegido — sin él, ver "La Mira" implicaba scrollear
              pasando Compartidas/Planazo/Otras primero. */}
          <GroupSelect groups={accordionGroups} />
          {referenceHtml && (
            <section className="cr-reference">
              <h2 className="cr-reference-heading">Tendencias generales</h2>
              <div className="cr-accordion" dangerouslySetInnerHTML={{ __html: referenceHtml }} />
            </section>
          )}
        </div>
      </div>
    </CmsShell>
  );
}
