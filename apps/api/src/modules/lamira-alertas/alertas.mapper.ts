import type { Alerta } from '@planazo/types';

interface AlertaRow {
  id: string;
  slug: string;
  siteId: string;
  title: string;
  alertaStatus: Alerta['alertaStatus'];
  category: { id: string; name: string; slug: string; siteId: string | null; fieldSchema: unknown[] } | null;
  alcaldiaSlug: string | null;
  updatedAt: Date | string;
  description: string;
  updates: Alerta['updates'];
  seo: Alerta['seo'];
  imageUrl: string | null;
  imageCredit: string | null;
  categoryData: Record<string, unknown>;
  content: Alerta['content'];
  createdAt: Date | string;
}

const toIso = (v: Date | string) => (v instanceof Date ? v.toISOString() : v);

export function toAlerta(row: AlertaRow): Alerta {
  return {
    id: row.id,
    slug: row.slug,
    siteId: row.siteId,
    title: row.title,
    alertaStatus: row.alertaStatus,
    category: row.category as Alerta['category'],
    alcaldiaSlug: row.alcaldiaSlug,
    updatedAt: toIso(row.updatedAt),
    description: row.description,
    updates: row.updates,
    seo: row.seo ?? null,
    imageUrl: row.imageUrl,
    imageCredit: row.imageCredit,
    categoryData: row.categoryData,
    content: row.content,
    createdAt: toIso(row.createdAt),
  };
}
