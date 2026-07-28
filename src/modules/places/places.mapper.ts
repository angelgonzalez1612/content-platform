import type { Place, PlaceDetail } from '@planazo/types';

type PlaceCategoryRow = {
  category: { id: string; name: string; slug: string };
};
type PlaceTagRow = { tag: { id: string; name: string; slug: string } };
type PlaceServiceRow = { service: { id: string; name: string; slug: string } };

interface PlaceRow {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  zone: string | null;
  latitude: string | null;
  longitude: string | null;
  address: string | null;
  priceLevel: number | null;
  price: number | null;
  rating: number | null;
  reviewCount: number;
  phone: string | null;
  website: string | null;
  status: Place['status'];
  createdAt: Date | string;
  updatedAt: Date | string;
  photos: Array<{
    id: string;
    url: string;
    alt: string | null;
    position: number;
  }>;
  placeCategories: PlaceCategoryRow[];
  placeTags: PlaceTagRow[];
}

interface PlaceDetailRow extends PlaceRow {
  placeServices: PlaceServiceRow[];
  socialLinks: Array<{ id: string; platform: string; url: string }>;
  openingHours: Array<{
    id: string;
    dayOfWeek: number;
    opensAt: string | null;
    closesAt: string | null;
    closed: boolean;
  }>;
  promotions: Array<{
    id: string;
    title: string;
    description: string | null;
    discountLabel: string | null;
    startDate: Date | string | null;
    endDate: Date | string | null;
    status: Place['status'];
  }>;
  articlePlaces: Array<{
    article: {
      id: string;
      slug: string;
      title: string;
      excerpt: string | null;
      coverImageUrl: string | null;
      publishedAt: Date | string | null;
    };
  }>;
}

const toIso = (value: Date | string) =>
  value instanceof Date ? value.toISOString() : value;
const toIsoOrNull = (value: Date | string | null) =>
  value ? toIso(value) : null;

export function toPlaceSummary(row: PlaceRow): Place {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    zone: row.zone,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    priceLevel: row.priceLevel,
    price: row.price,
    rating: row.rating,
    reviewCount: row.reviewCount,
    phone: row.phone,
    website: row.website,
    status: row.status,
    categories: row.placeCategories.map((pc) => pc.category),
    tags: row.placeTags.map((pt) => pt.tag),
    photos: row.photos,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

export function toPlaceDetail(row: PlaceDetailRow): PlaceDetail {
  return {
    ...toPlaceSummary(row),
    services: row.placeServices.map((ps) => ps.service),
    socialLinks: row.socialLinks,
    openingHours: row.openingHours,
    promotions: row.promotions.map((p) => ({
      ...p,
      startDate: toIsoOrNull(p.startDate),
      endDate: toIsoOrNull(p.endDate),
    })),
    articles: row.articlePlaces.map((ap) => ({
      ...ap.article,
      publishedAt: toIsoOrNull(ap.article.publishedAt),
    })),
  };
}
