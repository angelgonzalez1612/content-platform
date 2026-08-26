import { XMLParser } from "fast-xml-parser";
import type { SiteConfig } from "./sites";

// RSS directo de medios (no vía Google News): más control de calidad, feeds abiertos
// de siempre, sin intermediario ni riesgo de que nos bloqueen como pasó con Reddit.
// Verificados en vivo antes de construir esto — ver README.

export interface DirectNewsItem {
  title: string;
  url: string;
  source: string;
}

export interface CategoryDirectNews {
  category: string;
  items: DirectNewsItem[];
}

const parser = new XMLParser({ ignoreAttributes: false });

async function fetchFeed(url: string, sourceName: string, limit: number): Promise<DirectNewsItem[]> {
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 (content-radar CLI)" } });
  if (!res.ok) {
    throw new Error(`RSS respondió ${res.status} para "${url}"`);
  }
  const xml = await res.text();
  const data = parser.parse(xml);

  const items = data?.rss?.channel?.item;
  const list = Array.isArray(items) ? items : items ? [items] : [];

  return list.slice(0, limit).map((item: any): DirectNewsItem => ({
    title: (item.title ?? "").replace(/\s+/g, " ").trim(),
    url: item.link ?? "",
    source: sourceName,
  }));
}

export async function getDirectNewsByCategory(
  site: SiteConfig,
  limitPerFeed = 5
): Promise<CategoryDirectNews[]> {
  const withFeeds = site.categories.filter((c) => c.directRss && c.directRss.length > 0);

  return Promise.all(
    withFeeds.map(async ({ slug, directRss }) => {
      const perFeed = await Promise.all(
        directRss!.map(({ url, source }) =>
          fetchFeed(url, source, limitPerFeed).catch(() => [])
        )
      );
      return { category: slug, items: perFeed.flat() };
    })
  );
}
