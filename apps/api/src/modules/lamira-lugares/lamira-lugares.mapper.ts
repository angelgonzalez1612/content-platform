import type { LamiraLugar } from '@planazo/types';

interface LamiraLugarRow {
  id: string;
  slug: string;
  siteId: string;
  name: string;
  kind: LamiraLugar['kind'];
  category: { id: string; name: string; slug: string; siteId: string | null; fieldSchema: unknown[] } | null;
  alcaldiaSlug: string;
  colonia: string | null;
  description: string;
  seo: LamiraLugar['seo'];
  categoryData: Record<string, unknown>;
  createdAt: Date | string;
}

const toIso = (v: Date | string) => (v instanceof Date ? v.toISOString() : v);

export function toLamiraLugar(row: LamiraLugarRow): LamiraLugar {
  return {
    id: row.id,
    slug: row.slug,
    siteId: row.siteId,
    name: row.name,
    kind: row.kind,
    category: row.category as LamiraLugar['category'],
    alcaldiaSlug: row.alcaldiaSlug,
    colonia: row.colonia,
    description: row.description,
    seo: row.seo ?? null,
    categoryData: row.categoryData,
    createdAt: toIso(row.createdAt),
  };
}
