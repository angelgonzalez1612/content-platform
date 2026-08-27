import type { Reportaje } from '@planazo/types';

interface ReportajeRow {
  id: string;
  slug: string;
  siteId: string;
  title: string;
  dek: string;
  authorSlug: string;
  category: { id: string; name: string; slug: string; siteId: string | null; fieldSchema: unknown[] } | null;
  publishedAt: Date | string;
  readingTime: string;
  status: Reportaje['status'];
  tags: string[];
  sourceKind: string | null;
  seo: Reportaje['seo'];
  imageCaption: string;
  imageUrl: string | null;
  imageCredit: string | null;
  toc: Reportaje['toc'];
  content: Reportaje['content'];
  categoryData: Record<string, unknown>;
  createdAt: Date | string;
}

const toIso = (v: Date | string) => (v instanceof Date ? v.toISOString() : v);

export function toReportaje(row: ReportajeRow): Reportaje {
  return {
    id: row.id,
    slug: row.slug,
    siteId: row.siteId,
    title: row.title,
    dek: row.dek,
    authorSlug: row.authorSlug,
    category: row.category as Reportaje['category'],
    publishedAt: toIso(row.publishedAt),
    readingTime: row.readingTime,
    status: row.status,
    tags: row.tags,
    sourceKind: row.sourceKind,
    seo: row.seo ?? null,
    imageCaption: row.imageCaption,
    imageUrl: row.imageUrl,
    imageCredit: row.imageCredit,
    toc: row.toc,
    content: row.content,
    categoryData: row.categoryData,
    createdAt: toIso(row.createdAt),
  };
}
