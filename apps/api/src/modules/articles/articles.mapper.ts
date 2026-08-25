import type { Article } from '@planazo/types';
import { toPlaceSummary } from '../places/places.mapper';

type PlaceRow = Parameters<typeof toPlaceSummary>[0];

interface ArticleRow {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string | null;
  coverImageUrl: string | null;
  status: Article['status'];
  aiGenerated: boolean;
  sourceKeyword: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  canonicalUrl: string | null;
  ogImageUrl: string | null;
  categoryData: Record<string, unknown>;
  publishedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  articlePlaces: Array<{ place: PlaceRow }>;
}

const toIso = (value: Date | string) => (value instanceof Date ? value.toISOString() : value);
const toIsoOrNull = (value: Date | string | null) => (value ? toIso(value) : null);

export function toArticle(row: ArticleRow): Article {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    content: row.content,
    coverImageUrl: row.coverImageUrl,
    status: row.status,
    aiGenerated: row.aiGenerated,
    sourceKeyword: row.sourceKeyword,
    seoTitle: row.seoTitle,
    seoDescription: row.seoDescription,
    canonicalUrl: row.canonicalUrl,
    ogImageUrl: row.ogImageUrl,
    categoryData: row.categoryData,
    places: row.articlePlaces.map((ap) => toPlaceSummary(ap.place)),
    publishedAt: toIsoOrNull(row.publishedAt),
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}
