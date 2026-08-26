import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { SiteConfig } from "./sites";
import { todayLocal } from "./date";

// YouTube Data API v3 es gratis y NO cobra por exceder la cuota — simplemente rechaza
// llamadas (403 quotaExceeded) hasta que se resetea a medianoche hora Pacífico. Aun así,
// llevamos nuestro propio contador y cortamos ANTES del tope que tú configures (no
// esperamos a que Google nos rechace), para tener margen real y no andar al límite.
const SEARCH_COST_UNITS = 100;
const DEFAULT_DAILY_BUDGET = 8000; // colchón bajo las 10,000 gratis/día por defecto de Google

const USAGE_FILE = path.resolve("reports", ".youtube-usage.json");

interface UsageState {
  date: string; // YYYY-MM-DD, hora local
  unitsUsed: number;
}

async function readUsage(): Promise<UsageState> {
  try {
    const raw = await readFile(USAGE_FILE, "utf-8");
    const parsed = JSON.parse(raw) as UsageState;
    return parsed.date === todayLocal() ? parsed : { date: todayLocal(), unitsUsed: 0 };
  } catch {
    return { date: todayLocal(), unitsUsed: 0 };
  }
}

async function writeUsage(state: UsageState): Promise<void> {
  try {
    await writeFile(USAGE_FILE, JSON.stringify(state), "utf-8");
  } catch {
    // si no se pudo persistir, la próxima corrida vuelve a contar desde cero — no es
    // razón para tronar el reporte completo.
  }
}

export interface YoutubeVideo {
  title: string;
  url: string;
  channel: string;
}

export interface CategoryYoutubeVideos {
  category: string;
  videos: YoutubeVideo[];
}

async function searchYoutube(apiKey: string, query: string, limit: number): Promise<YoutubeVideo[]> {
  const url =
    `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video` +
    `&order=relevance&regionCode=MX&relevanceLanguage=es&maxResults=${limit}` +
    `&q=${encodeURIComponent(query)}&key=${apiKey}`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`YouTube Data API respondió ${res.status} para "${query}"`);
  }
  const data = await res.json();
  const items = data?.items ?? [];

  return items.map((item: any): YoutubeVideo => ({
    title: item.snippet?.title ?? "",
    url: `https://www.youtube.com/watch?v=${item.id?.videoId}`,
    channel: item.snippet?.channelTitle ?? "",
  }));
}

// Sin YOUTUBE_API_KEY configurada, regresa [] silenciosamente — la sección de YouTube
// simplemente no aparece, igual que con Google News/Reddit cuando falta algo opcional.
// Si ya se llegó al presupuesto diario propio (YOUTUBE_DAILY_UNIT_BUDGET, default 8000),
// tampoco truena: deja de pedir videos nuevos hasta el día siguiente.
export async function getYoutubeByCategory(
  site: SiteConfig,
  limitPerCategory = 5
): Promise<CategoryYoutubeVideos[]> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) return [];

  const budget = Number(process.env.YOUTUBE_DAILY_UNIT_BUDGET) || DEFAULT_DAILY_BUDGET;
  const usage = await readUsage();
  const remaining = budget - usage.unitsUsed;
  const callsAllowed = Math.max(0, Math.floor(remaining / SEARCH_COST_UNITS));

  if (callsAllowed === 0) {
    console.warn(
      `[youtube] presupuesto diario (${budget} unidades) agotado — se salta YouTube en esta corrida.`
    );
    return [];
  }

  const withSeed = site.categories.filter((c) => c.searchSeed);
  const toQuery = withSeed.slice(0, callsAllowed);
  if (toQuery.length < withSeed.length) {
    console.warn(
      `[youtube] presupuesto casi agotado: solo ${toQuery.length}/${withSeed.length} categorías esta corrida.`
    );
  }

  const results = await Promise.all(
    toQuery.map(async ({ slug, searchSeed }) => {
      try {
        const videos = await searchYoutube(apiKey, searchSeed!.trim(), limitPerCategory);
        return { category: slug, videos, called: true };
      } catch {
        return { category: slug, videos: [], called: true };
      }
    })
  );

  const callsMade = results.filter((r) => r.called).length;
  await writeUsage({ date: todayLocal(), unitsUsed: usage.unitsUsed + callsMade * SEARCH_COST_UNITS });

  return results.map(({ category, videos }) => ({ category, videos }));
}
