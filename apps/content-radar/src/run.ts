import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { getTrendingNow } from "./trends.js";
import { getCdmxNewsByCategory } from "./cdmxNews.js";
import { getDirectNewsByCategory } from "./directNews.js";
import { getCategorySearchPhrases, getSearchPhrases } from "./suggest.js";
import { getCdmxWeather } from "./weather.js";
import { getYoutubeByCategory } from "./youtube.js";
import { getBingStatsByCategory } from "./bingKeywords.js";
import { getTmdbTrending } from "./tmdb.js";
import { todayLocal } from "./date.js";
import { scoreTopics } from "./relevance.js";
import { buildMarkdownReport } from "./report.js";
import { getSite } from "./sites.js";

export const REPORTS_DIR = path.resolve("reports");

export interface RunResult {
  file: string;
  fileName: string;
  report: string;
}

export function reportFileName(today: string, geo: string, siteId: string): string {
  return `${today}-${geo}-${siteId}.md`;
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
  const fileName = reportFileName(today, geo, site.id);
  const file = path.join(REPORTS_DIR, fileName);
  await writeFile(file, report, "utf-8");

  return { file, fileName, report };
}
