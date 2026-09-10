import type { GuideSection, PlanazoGuide } from '@planazo/types';

interface GuideRow {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: string | null;
  intro: string | null;
  sections: GuideSection[];
  categoryLabel: string;
  readTime: string;
  imageUrl: string | null;
  imageAlt: string | null;
  imageCredit: string | null;
  excerpt: string | null;
  budget: string | null;
  duration: string | null;
  audience: string[];
  status: PlanazoGuide['status'];
  createdAt: Date | string;
  updatedAt: Date | string;
}

const toIso = (value: Date | string) => (value instanceof Date ? value.toISOString() : value);

export function toPlanazoGuide(row: GuideRow): PlanazoGuide {
  const placeSlugs = [...new Set(row.sections.map((s) => s.placeSlug).filter((s): s is string => Boolean(s)))];

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    type: row.type,
    intro: row.intro,
    sections: row.sections,
    categoryLabel: row.categoryLabel,
    readTime: row.readTime,
    imageUrl: row.imageUrl,
    imageAlt: row.imageAlt,
    imageCredit: row.imageCredit,
    placeSlugs,
    excerpt: row.excerpt,
    budget: row.budget,
    duration: row.duration,
    audience: row.audience,
    status: row.status,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}
