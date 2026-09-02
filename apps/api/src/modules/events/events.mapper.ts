import type { PlanazoEvent } from '@planazo/types';
import { toPlaceSummary } from '../places/places.mapper';

type PlaceRow = Parameters<typeof toPlaceSummary>[0];

interface EventRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  startDate: Date | string | null;
  endDate: Date | string | null;
  locationName: string | null;
  alcaldiaSlug: string | null;
  categoryId: string | null;
  category: { id: string; name: string; slug: string } | null;
  status: PlanazoEvent['status'];
  categoryData: Record<string, unknown>;
  seo: PlanazoEvent['seo'];
  place: PlaceRow | null;
  imageUrl: string | null;
  imageCredit: string | null;
  content: PlanazoEvent['content'];
}

const toIso = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : value;
const toIsoOrNull = (value: Date | string | null) =>
  value ? toIso(value) : null;

export function toPlanazoEvent(row: EventRow): PlanazoEvent {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    startDate: toIsoOrNull(row.startDate),
    endDate: toIsoOrNull(row.endDate),
    locationName: row.locationName,
    alcaldiaSlug: row.alcaldiaSlug,
    place: row.place ? toPlaceSummary(row.place) : null,
    categoryId: row.categoryId,
    category: row.category,
    status: row.status,
    categoryData: row.categoryData,
    seo: row.seo ?? null,
    imageUrl: row.imageUrl,
    imageCredit: row.imageCredit,
    content: row.content,
  };
}
