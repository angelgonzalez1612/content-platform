import type { Noticia } from '@planazo/types';

interface NoticiaRow {
  id: string;
  slug: string;
  siteId: string;
  title: string;
  dek: string;
  category: { id: string; name: string; slug: string; siteId: string | null; fieldSchema: unknown[] } | null;
  alcaldiaSlug: string | null;
  colonia: string | null;
  authorSlug: string;
  publishedAt: Date | string;
  updatedAt: Date | string | null;
  readingTime: string;
  status: Noticia['status'];
  sourceKind: string | null;
  externalSource: string | null;
  youtubeId: string | null;
  tags: string[];
  seo: Noticia['seo'];
  toc: Noticia['toc'];
  content: Noticia['content'];
  imageCaption: string | null;
  imageUrl: string | null;
  imageCredit: string | null;
  featured: boolean;
  tag: string | null;
  categoryData: Record<string, unknown>;
  createdAt: Date | string;
}

const toIso = (v: Date | string) => (v instanceof Date ? v.toISOString() : v);
const toIsoOrNull = (v: Date | string | null) => (v ? toIso(v) : null);

export function toNoticia(row: NoticiaRow): Noticia {
  return {
    id: row.id,
    slug: row.slug,
    siteId: row.siteId,
    title: row.title,
    dek: row.dek,
    category: row.category as Noticia['category'],
    alcaldiaSlug: row.alcaldiaSlug,
    colonia: row.colonia,
    authorSlug: row.authorSlug,
    publishedAt: toIso(row.publishedAt),
    updatedAt: toIsoOrNull(row.updatedAt),
    readingTime: row.readingTime,
    status: row.status,
    sourceKind: row.sourceKind,
    externalSource: row.externalSource,
    youtubeId: row.youtubeId,
    tags: row.tags,
    seo: row.seo ?? null,
    toc: row.toc,
    content: row.content,
    imageCaption: row.imageCaption,
    imageUrl: row.imageUrl,
    imageCredit: row.imageCredit,
    featured: row.featured,
    tag: row.tag,
    categoryData: row.categoryData,
    createdAt: toIso(row.createdAt),
  };
}
