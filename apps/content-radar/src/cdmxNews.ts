import { XMLParser } from "fast-xml-parser";
import type { SiteConfig } from "./sites";

export interface NewsItem {
  title: string;
  url: string;
  source: string;
}

export interface CategoryNews {
  category: string;
  items: NewsItem[];
}

const parser = new XMLParser({ ignoreAttributes: false });

async function fetchGoogleNews(query: string, limit: number): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=es-419&gl=MX&ceid=MX:es-419`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (content-radar CLI)" },
  });
  if (!res.ok) {
    throw new Error(`Google News RSS respondió ${res.status} para "${query}"`);
  }
  const xml = await res.text();
  const data = parser.parse(xml);

  const items = data?.rss?.channel?.item;
  const list = Array.isArray(items) ? items : items ? [items] : [];

  return list.slice(0, limit).map((item: any): NewsItem => {
    const source: string = (typeof item.source === "object" ? item.source["#text"] : item.source) ?? "";
    const rawTitle: string = item.title ?? "";
    // Google News agrega " - Fuente" al título; ya mostramos la fuente aparte, así que la quitamos de acá.
    const title = source && rawTitle.endsWith(` - ${source}`)
      ? rawTitle.slice(0, -(source.length + 3))
      : rawTitle;

    return { title, url: item.link ?? "", source };
  });
}

export async function getCdmxNewsByCategory(site: SiteConfig, limitPerCategory = 5): Promise<CategoryNews[]> {
  return Promise.all(
    site.categories.map(async ({ slug, cdmxQuery }) => {
      try {
        const items = await fetchGoogleNews(cdmxQuery, limitPerCategory);
        return { category: slug, items };
      } catch {
        return { category: slug, items: [] };
      }
    })
  );
}
