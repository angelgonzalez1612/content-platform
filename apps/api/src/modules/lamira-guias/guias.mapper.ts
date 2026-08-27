import type { Guia } from '@planazo/types';

interface GuiaRow {
  id: string;
  slug: string;
  siteId: string;
  title: string;
  dek: string;
  groupSlug: string;
  category: { id: string; name: string; slug: string; siteId: string | null; fieldSchema: unknown[] } | null;
  updatedAt: Date | string;
  readingTime: string;
  status: Guia['status'];
  officialSource: Guia['officialSource'];
  quickFacts: Guia['quickFacts'];
  seo: Guia['seo'];
  toc: Guia['toc'];
  content: Guia['content'];
  faq: Guia['faq'];
  imageUrl: string | null;
  imageCredit: string | null;
  categoryData: Record<string, unknown>;
  createdAt: Date | string;
}

const toIso = (v: Date | string) => (v instanceof Date ? v.toISOString() : v);

export function toGuia(row: GuiaRow): Guia {
  return {
    id: row.id,
    slug: row.slug,
    siteId: row.siteId,
    title: row.title,
    dek: row.dek,
    groupSlug: row.groupSlug,
    category: row.category as Guia['category'],
    updatedAt: toIso(row.updatedAt),
    readingTime: row.readingTime,
    status: row.status,
    officialSource: row.officialSource ?? null,
    quickFacts: row.quickFacts,
    seo: row.seo ?? null,
    toc: row.toc,
    content: row.content,
    faq: row.faq,
    imageUrl: row.imageUrl,
    imageCredit: row.imageCredit,
    categoryData: row.categoryData,
    createdAt: toIso(row.createdAt),
  };
}
