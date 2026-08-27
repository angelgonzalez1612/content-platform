import type { PlanazoEvent } from '@planazo/types';
import { toPlaceSummary } from '../places/places.mapper';

type PlaceRow = Parameters<typeof toPlaceSummary>[0];

interface EventRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  startDate: Date | string;
  endDate: Date | string | null;
  locationName: string | null;
  categoryId: string | null;
  status: PlanazoEvent['status'];
  categoryData: Record<string, unknown>;
  seo: PlanazoEvent['seo'];
  place: PlaceRow | null;
}

const toIso = (value: Date | string) => (value instanceof Date ? value.toISOString() : value);
const toIsoOrNull = (value: Date | string | null) => (value ? toIso(value) : null);

export function toPlanazoEvent(row: EventRow): PlanazoEvent {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    startDate: toIso(row.startDate),
    endDate: toIsoOrNull(row.endDate),
    locationName: row.locationName,
    place: row.place ? toPlaceSummary(row.place) : null,
    categoryId: row.categoryId,
    status: row.status,
    categoryData: row.categoryData,
    seo: row.seo ?? null,
  };
}
