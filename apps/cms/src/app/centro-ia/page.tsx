import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getCmsCategories, getContentRadarPublishedTitles, getSearchPhrases } from "@/lib/cms-api";
import { listReports, readReportFile, extractTopics, normalizeTitle } from "@planazo/content-radar/render";
import { DEFAULT_SITE_ID } from "@planazo/content-radar/sites";
import { CmsShell } from "@/components/cms/cms-shell";
import { GeneratePlaceFlow } from "@/components/cms/generate-place-flow";
import { GenerateLamiraContentFlow } from "@/components/cms/lamira/generate-lamira-content-flow";
import { GenerateEventFlow } from "@/components/cms/planazo/generate-event-flow";
import { PublishFlow, type RadarTopic, type SavedPhrase } from "@/components/cms/publish-flow";
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

// Modo "Frases guardadas" — frases reales de "qué busca la gente" en
// /automatizaciones/frases (SearchPhrasesService), como tema de partida sin
// tener que volver a escribirlo. Se excluyen "used"/"discarded" (ya se
// usaron o se descartaron a propósito). Cuando ya se investigó y tiene
// fuentes reales (candidateLinks — requiere GOOGLE_SEARCH_API_KEY
// configurada, ver env.ts), se incluyen como material citable; sin ellas,
// la frase igual sirve como tema (mismo tratamiento que el modo "Por tema").
// Los hints se arman aquí, servidor — el cliente solo los manda como
// `hints`, igual que cualquier otro texto libre (ver AiDraftService.draft).
async function getSavedPhrasesForGeneration(): Promise<SavedPhrase[]> {
  const phrases = await getSearchPhrases();
  return phrases
    .filter((p) => p.status !== "used" && p.status !== "discarded")
    .map((p) => ({
      phrase: p.phrase,
      categoryLabel: p.categoryLabel,
      hints:
        p.candidateLinks.length > 0
          ? [
              `Frase de búsqueda investigada: "${p.phrase}"${p.categoryLabel ? ` (categoría: ${p.categoryLabel})` : ""}.`,
              "Fuentes encontradas para esta frase:",
              ...p.candidateLinks.map((l) => `- ${l.title} — ${l.snippet} (${l.url})`),
            ].join("\n")
          : `Frase real de "Qué busca la gente": "${p.phrase}"${p.categoryLabel ? ` (categoría: ${p.categoryLabel})` : ""}. Sin fuentes investigadas todavía — trátalo como tema, no inventes datos verificables (fecha, ubicación, cifras).`,
    }));
}

export default async function CentroIaPage({
  searchParams,
}: {
  searchParams: Promise<{ site?: string; type?: string; name?: string; hints?: string; source?: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { site, type: rawType, name, hints, source } = await searchParams;

  // Sin `site`: viene del botón Publicar de content-radar, que ya no fija el
  // destino de antemano — la IA decide sitio+tipo+categoría juntos (ver
  // AiDraftService.classifyContentType). Con `site`: navegación manual vía
  // SiteTabs, el humano ya eligió el sitio a propósito — comportamiento sin
  // cambios.
  if (!site) {
    const [radarTopics, savedPhrases] = await Promise.all([getPendingRadarTopics(), getSavedPhrasesForGeneration()]);
    return (
      <CmsShell user={session} title="Centro IA">
        <PublishFlow initialName={name} initialHints={hints} source={source} radarTopics={radarTopics} savedPhrases={savedPhrases} />
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
    const [radarTopics, savedPhrases] = await Promise.all([getPendingRadarTopics(), getSavedPhrasesForGeneration()]);
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
              source={source}
              radarTopics={radarTopics}
              savedPhrases={savedPhrases}
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
