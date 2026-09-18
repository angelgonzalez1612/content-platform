import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getTrendingNow } from "./trends";
import { getCdmxNewsByCategory } from "./cdmxNews";
import { getDirectNewsByCategory } from "./directNews";
import { getCategorySearchPhrases, getSearchPhrases } from "./suggest";
import { getCdmxWeather } from "./weather";
import { getYoutubeByCategory } from "./youtube";
import { getBingStatsByCategory } from "./bingKeywords";
import { getTmdbTrending } from "./tmdb";
import { todayLocal, nowLocalTime } from "./date";
import { scoreTopics } from "./relevance";
import { buildMarkdownReport } from "./report";
import { getSite } from "./sites";

// Resuelto contra la ubicación real del archivo (no contra process.cwd()) —
// este módulo lo importan tanto el CLI (cwd = apps/content-radar) como el CMS
// (cwd = apps/cms o la raíz del monorepo), y REPORTS_DIR/.env deben apuntar
// siempre a apps/content-radar/{reports,.env} sin importar quién llama.
const PACKAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const REPORTS_DIR = path.join(PACKAGE_DIR, "reports");

try {
  process.loadEnvFile(path.join(PACKAGE_DIR, ".env"));
} catch {
  // sin .env es válido — YouTube/Bing/TMDB simplemente no aparecen en el reporte
}

export interface RunResult {
  file: string;
  fileName: string;
  report: string;
}

// `time` (HHmm) es la pieza nueva — antes el nombre solo tenía la fecha, así
// que la corrida de las 7am, la de mediodía y cualquier "Actualizar" manual
// del mismo día se pisaban entre sí (solo quedaba la última). Con la hora en
// el nombre, cada corrida deja su propio snapshot — eso es el "historial por
// transcurso del día" que se veía perdido. `time` es opcional únicamente
// para que reportFileName siga sirviendo para reconstruir nombres de
// archivos viejos (antes de este cambio) si algo los necesita.
export function reportFileName(today: string, geo: string, siteId: string, time?: string): string {
  return time ? `${today}-${time}-${geo}-${siteId}.md` : `${today}-${geo}-${siteId}.md`;
}

// Consulta Trending Now + Google News CDMX + RSS directo de medios + YouTube +
// volumen real de Bing (por categoría) + frases de autocompletado + clima real (si
// el sitio tiene categoría "clima"), categoriza y guarda el reporte en disco. La usan
// el CLI, el server web y la tarea programada.
export async function runAndSave(siteId: string, geo: string): Promise<RunResult> {
  const site = getSite(siteId);
  const hasClimaCategory = site.categories.some((c) => c.slug === "clima");
  const hasCineTvCategory = site.categories.some((c) => c.slug === "cine-tv");

  const [
    topics,
    cdmxNews,
    directNews,
    youtubeVideos,
    bingStats,
    searchPhrases,
    categoryPhrases,
    weather,
    tmdbTrending,
  ] = await Promise.all([
    getTrendingNow(geo),
    getCdmxNewsByCategory(site),
    getDirectNewsByCategory(site),
    getYoutubeByCategory(site),
    getBingStatsByCategory(site),
    site.searchSeeds ? getSearchPhrases(site.searchSeeds) : Promise.resolve([]),
    getCategorySearchPhrases(site.categories),
    hasClimaCategory ? getCdmxWeather() : Promise.resolve(null),
    hasCineTvCategory ? getTmdbTrending() : Promise.resolve([]),
  ]);
  const scored = scoreTopics(topics, site);
  const report = buildMarkdownReport(
    site,
    geo,
    scored,
    cdmxNews,
    searchPhrases,
    categoryPhrases,
    weather,
    directNews,
    youtubeVideos,
    bingStats,
    tmdbTrending
  );

  await mkdir(REPORTS_DIR, { recursive: true });
  const today = todayLocal();
  const fileName = reportFileName(today, geo, site.id, nowLocalTime());
  const file = path.join(REPORTS_DIR, fileName);
  await writeFile(file, report, "utf-8");

  return { file, fileName, report };
}
