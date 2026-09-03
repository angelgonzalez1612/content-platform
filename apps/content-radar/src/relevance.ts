import type { TrendTopic } from "./trends";
import type { SiteConfig } from "./sites";

export interface ScoredTopic extends TrendTopic {
  categories: string[];
}

// Rango Unicode de marcas diacríticas combinantes (0x0300-0x036F), construido por
// código en vez de como literal para evitar problemas de encoding en el archivo fuente.
const DIACRITICS = new RegExp(
  `[${String.fromCharCode(0x0300)}-${String.fromCharCode(0x036f)}]`,
  "g"
);

export function normalize(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(DIACRITICS, "");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Coincidencia por palabra completa (\b), no substring — evita falsos positivos
// como "app" matcheando dentro de "appearance".
export function containsKeyword(haystack: string, keyword: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(normalize(keyword))}\\b`);
  return pattern.test(haystack);
}

export function scoreTopic(topic: TrendTopic, site: SiteConfig): ScoredTopic {
  const haystack = normalize(
    [topic.title, ...topic.newsItems.flatMap((n) => [n.title, n.snippet ?? ""])].join(" ")
  );

  const categories = site.categories
    .filter((cat) => cat.keywords.some((kw) => containsKeyword(haystack, kw)))
    .map((cat) => cat.slug);

  return { ...topic, categories };
}

export function scoreTopics(topics: TrendTopic[], site: SiteConfig): ScoredTopic[] {
  return topics.map((t) => scoreTopic(t, site));
}
