import type { LamiraEvento } from '@planazo/types';

interface LamiraEventoRow {
  id: string;
  slug: string;
  siteId: string;
  title: string;
  tag: string;
  category: { id: string; name: string; slug: string; siteId: string | null; fieldSchema: unknown[] } | null;
  eventoStatus: LamiraEvento['eventoStatus'];
  date: string;
  time: string;
  location: string;
  alcaldiaSlug: string | null;
  price: string;
  description: string;
  organizer: string;
  officialUrl: string | null;
  seo: LamiraEvento['seo'];
  imageUrl: string | null;
  imageCredit: string | null;
  categoryData: Record<string, unknown>;
  content: LamiraEvento['content'];
  createdAt: Date | string;
}

const toIso = (v: Date | string) => (v instanceof Date ? v.toISOString() : v);

export function toLamiraEvento(row: LamiraEventoRow): LamiraEvento {
  return {
    id: row.id,
    slug: row.slug,
    siteId: row.siteId,
    title: row.title,
    tag: row.tag,
    category: row.category as LamiraEvento['category'],
    eventoStatus: row.eventoStatus,
    date: row.date,
    time: row.time,
    location: row.location,
    alcaldiaSlug: row.alcaldiaSlug,
    price: row.price,
    description: row.description,
    organizer: row.organizer,
    officialUrl: row.officialUrl,
    seo: row.seo ?? null,
    imageUrl: row.imageUrl,
    imageCredit: row.imageCredit,
    categoryData: row.categoryData,
    content: row.content,
    createdAt: toIso(row.createdAt),
  };
}
