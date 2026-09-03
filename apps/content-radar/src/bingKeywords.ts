import type { SiteConfig } from "./sites";

// Bing Webmaster API (endpoint JSON/HTTP, no el SOAP/POX que Microsoft retira el
// 31 de agosto de 2026 — verificado en vivo, misma URL con "/json/" es la que
// sobrevive). Da volumen de búsqueda REAL semanal en Bing, no una estimación.
// Requiere BING_WEBMASTER_API_KEY (gratis, solo pide verificar un dominio propio
// en Bing Webmaster Tools).
export interface BingKeywordStat {
  avgWeeklyImpressions: number;
  avgWeeklyBroadImpressions: number;
}

export interface CategoryBingStat {
  category: string;
  stat: BingKeywordStat | null;
}

interface RawWeek {
  Impressions: number;
  BroadImpressions: number;
}

async function getKeywordStats(apiKey: string, query: string): Promise<BingKeywordStat | null> {
  const url =
    `https://ssl.bing.com/webmaster/api.svc/json/GetKeywordStats` +
    `?apikey=${apiKey}&q=${encodeURIComponent(query)}&country=mx&language=es-MX`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Bing Webmaster API respondió ${res.status} para "${query}"`);
  }
  const data = (await res.json()) as { d?: RawWeek[] };
  const weeks = data.d ?? [];
  if (weeks.length === 0) return null;

  const avgWeeklyImpressions = Math.round(
    weeks.reduce((sum, w) => sum + (w.Impressions ?? 0), 0) / weeks.length
  );
  const avgWeeklyBroadImpressions = Math.round(
    weeks.reduce((sum, w) => sum + (w.BroadImpressions ?? 0), 0) / weeks.length
  );

  return { avgWeeklyImpressions, avgWeeklyBroadImpressions };
}

// Sin BING_WEBMASTER_API_KEY configurada, regresa [] silenciosamente — igual que las
// demás fuentes opcionales. Muchas frases de cola larga no tienen datos en Bing
// (mercado chico en México); esas categorías simplemente no muestran el dato.
export async function getBingStatsByCategory(site: SiteConfig): Promise<CategoryBingStat[]> {
  const apiKey = process.env.BING_WEBMASTER_API_KEY;
  if (!apiKey) return [];

  const withSeed = site.categories.filter((c) => c.searchSeed);

  return Promise.all(
    withSeed.map(async ({ slug, searchSeed }) => {
      try {
        const stat = await getKeywordStats(apiKey, searchSeed!.trim());
        return { category: slug, stat };
      } catch {
        return { category: slug, stat: null };
      }
    })
  );
}
