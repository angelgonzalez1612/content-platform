import { XMLParser } from "fast-xml-parser";

export interface TrendNewsItem {
  title: string;
  url: string;
  source: string;
  snippet?: string;
}

export interface TrendTopic {
  title: string;
  traffic: string;
  pubDate?: string;
  newsItems: TrendNewsItem[];
}

const parser = new XMLParser({ ignoreAttributes: false });

// Fuente actual de Google Trends "Trending Now" (reemplazo del viejo /trends/api/dailytrends,
// que Google dio de baja — devuelve 404). No requiere API key.
export async function getTrendingNow(geo: string): Promise<TrendTopic[]> {
  const url = `https://trends.google.com/trending/rss?geo=${encodeURIComponent(geo)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (content-radar CLI)" },
  });
  if (!res.ok) {
    throw new Error(`Google Trends RSS respondió ${res.status} para geo=${geo}`);
  }
  const xml = await res.text();
  const data = parser.parse(xml);

  const items = data?.rss?.channel?.item;
  const list = Array.isArray(items) ? items : items ? [items] : [];

  return list.map((item: any): TrendTopic => {
    const rawNews = item["ht:news_item"];
    const newsList = Array.isArray(rawNews) ? rawNews : rawNews ? [rawNews] : [];

    return {
      title: item.title ?? "",
      traffic: item["ht:approx_traffic"] ?? "",
      pubDate: item.pubDate,
      newsItems: newsList.slice(0, 5).map((n: any) => ({
        title: n["ht:news_item_title"] ?? "",
        url: n["ht:news_item_url"] ?? "",
        source: n["ht:news_item_source"] ?? "",
        snippet: n["ht:news_item_snippet"] || undefined,
      })),
    };
  });
}
