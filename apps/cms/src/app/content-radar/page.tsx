import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CmsShell } from "@/components/cms/cms-shell";
import { listReports, parseFileName, readReportFile, renderReport } from "@planazo/content-radar/render";
import { DEFAULT_SITE_ID } from "@planazo/content-radar/sites";
import { refreshContentRadar } from "./actions";
import { ReportPicker } from "./report-picker";
import "./content-radar.css";

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

  const raw = await readReportFile(activeFile);
  const { leadingHtml, heroHtml, accordionHtml, referenceHtml } = await renderReport(raw);

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
          {accordionHtml && <div className="cr-accordion" dangerouslySetInnerHTML={{ __html: accordionHtml }} />}
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
