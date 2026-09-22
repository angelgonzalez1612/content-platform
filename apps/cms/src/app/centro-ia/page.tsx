import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCmsCategories, getCmsPlaces, getCmsEvents, getContentRadarPublishedTitles } from "@/lib/cms-api";
import { listReports, readReportFile, extractTopics, normalizeTitle } from "@planazo/content-radar/render";
import { DEFAULT_SITE_ID } from "@planazo/content-radar/sites";
import type { Place, PlanazoEvent } from "@planazo/types";
import { CmsShell } from "@/components/cms/cms-shell";
import { GeneratePlaceFlow } from "@/components/cms/generate-place-flow";
import { GenerateLamiraContentFlow } from "@/components/cms/lamira/generate-lamira-content-flow";
import { GenerateEventFlow } from "@/components/cms/planazo/generate-event-flow";
import { PublishFlow, type RadarTopic, type PlanazoReference } from "@/components/cms/publish-flow";
import { CrearSteps, ProjectPill } from "@/components/cms/crear-steps";

const LAMIRA_TYPES = new Set(["noticia", "alerta", "guia", "evento", "lugar", "reportaje"]);

// Modo "Content Radar" del formulario de generación — mismos título+hints
// que ya arma extractTopics para el motor de automatización (ver
// AiDraftService/content-radar/src/render.ts), del reporte más reciente,
// menos lo que ya se publicó. Sin categorySiteMap a propósito: ese filtro es
// para saber a qué SITIO manda cada tema — aquí ya se sabe (o no importa,
// en el flujo sin sitio fijo), así que ahorra tener que armarlo.
async function getPendingRadarTopics(): Promise<RadarTopic[]> {
  const files = await listReports(DEFAULT_SITE_ID);
  if (files.length === 0) return [];

  const [raw, publishedTitlesList] = await Promise.all([readReportFile(files[0]), getContentRadarPublishedTitles()]);
  const published = new Set(publishedTitlesList.map(normalizeTitle));
  const topics = await extractTopics(raw);

  const seen = new Set<string>();
  return topics
    .filter((t) => {
      const key = normalizeTitle(t.title);
      if (published.has(key) || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((t) => ({ title: t.title, hints: t.hints, categoryLabel: t.categoryLabel }));
}

// Modo "Desde Planazo" — lugares/eventos YA publicados como material de
// referencia real para una pieza de La Mira (ej. una alerta sobre un lugar
// que cierra). El resumen se arma aquí, servidor, con los datos tal como
// están en la base — el cliente solo lo manda como `hints`, mismo mecanismo
// que cualquier otro texto libre (ver AiDraftService.draft, no lee nada
// especial de este formato, es material para el prompt como cualquier otro).
function buildPlanazoReferences(places: Place[], events: PlanazoEvent[]): PlanazoReference[] {
  const fromPlaces = places
    .filter((p) => p.status === "published")
    .map((p) => ({
      slug: `place:${p.slug}`,
      label: `📍 ${p.name}`,
      summary: [
        "Lugar de referencia (dato real de Planazo — no inventes nada más allá de esto):",
        `Nombre: ${p.name}`,
        p.categories.length ? `Categoría: ${p.categories.map((c) => c.name).join(", ")}` : "",
        p.zone ? `Zona: ${p.zone}` : "",
        p.address ? `Dirección: ${p.address}` : "",
        p.description ? `Descripción: ${p.description}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    }));

  const fromEvents = events
    .filter((e) => e.status === "published")
    .map((e) => ({
      slug: `event:${e.slug}`,
      label: `📅 ${e.name}`,
      summary: [
        "Evento de referencia (dato real de Planazo — no inventes nada más allá de esto):",
        `Nombre: ${e.name}`,
        e.category ? `Categoría: ${e.category.name}` : "",
        e.locationName ? `Lugar: ${e.locationName}` : "",
        e.startDate ? `Fecha: ${e.startDate}` : "",
        e.description ? `Descripción: ${e.description}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    }));

  return [...fromPlaces, ...fromEvents].sort((a, b) => a.label.localeCompare(b.label));
}

export default async function CentroIaPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; type?: string; name?: string; hints?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { site, type: rawType, name, hints } = await searchParams;

  // Sin `site`: viene del botón Publicar de content-radar, que ya no fija el
  // destino de antemano — la IA decide sitio+tipo+categoría juntos (ver
  // AiDraftService.classifyContentType). Con `site`: navegación manual vía
  // SiteTabs, el humano ya eligió el sitio a propósito — comportamiento sin
  // cambios.
  if (!site) {
    const [radarTopics, places, events] = await Promise.all([getPendingRadarTopics(), getCmsPlaces(), getCmsEvents()]);
    return (
      <CmsShell user={session} title="Centro IA">
        <PublishFlow initialName={name} initialHints={hints} radarTopics={radarTopics} planazoReferences={buildPlanazoReferences(places, events)} />
      </CmsShell>
    );
  }

  const isLamira = site === "lamira";
  const validType = rawType && LAMIRA_TYPES.has(rawType) ? rawType : null;

  // La Mira ya no obliga a elegir Noticia/Alerta/Guía/Evento/Lugar/Reportaje
  // antes de generar con IA (ver LamiraCrearTypePicker) — sin tipo en la
  // URL, la IA lo clasifica sola dentro de los 6 tipos de La Mira (mismo
  // PublishFlow que usa el botón "Publicar" de content-radar, pero con el
  // sitio ya fijo — ver AiDraftService.classifyContentType/fixedSite).
  if (isLamira && !validType) {
    const [radarTopics, places, events] = await Promise.all([getPendingRadarTopics(), getCmsPlaces(), getCmsEvents()]);
    return (
      <CmsShell user={session} title="Centro IA">
        <div className="flex flex-col lg:h-full">
          <div className="flex-none px-[26px] pt-[26px]">
            <CrearSteps current={3} site="lamira" />
            <ProjectPill site="lamira" />
          </div>
          <div className="lg:min-h-0 lg:flex-1">
            <PublishFlow
              initialName={name}
              initialHints={hints}
              fixedSite="la-mira"
              radarTopics={radarTopics}
              planazoReferences={buildPlanazoReferences(places, events)}
            />
          </div>
        </div>
      </CmsShell>
    );
  }

  const type = validType ?? "noticia";
  const categories = await getCmsCategories(isLamira ? "la-mira" : "planazo");

  return (
    <CmsShell user={session} title="Centro IA">
      <div className="flex flex-col lg:h-full">
        <div className="flex-none px-[26px] pt-[26px]">
          <CrearSteps current={3} site={isLamira ? "lamira" : "planazo"} />
          <ProjectPill site={isLamira ? "lamira" : "planazo"} />
        </div>
        <div className="lg:min-h-0 lg:flex-1">
          {isLamira ? (
            <GenerateLamiraContentFlow type={type} categories={categories} initialName={name} initialHints={hints} />
          ) : rawType === "evento-planazo" ? (
            <GenerateEventFlow categories={categories} initialName={name} />
          ) : (
            <GeneratePlaceFlow categories={categories} initialName={name} />
          )}
        </div>
      </div>
    </CmsShell>
  );
}
