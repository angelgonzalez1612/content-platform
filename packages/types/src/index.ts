export type ContentStatus = 'draft' | 'in_review' | 'published' | 'archived';

export type UserRole = 'admin' | 'editor';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

export interface ServiceAmenity {
  id: string;
  name: string;
  slug: string;
}

export interface Photo {
  id: string;
  url: string;
  alt: string | null;
  position: number;
}

export interface SocialLink {
  id: string;
  platform: string;
  url: string;
}

export interface OpeningHour {
  id: string;
  dayOfWeek: number;
  opensAt: string | null;
  closesAt: string | null;
  closed: boolean;
}

export interface Promotion {
  id: string;
  title: string;
  description: string | null;
  discountLabel: string | null;
  startDate: string | null;
  endDate: string | null;
  status: ContentStatus;
}

export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  publishedAt: string | null;
}

/**
 * The central knowledge-graph entity. A Place is reused across articles,
 * rankings, events and promotions instead of duplicating data per content type.
 */
export interface Place {
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
  status: ContentStatus;
  categories: Category[];
  tags: Tag[];
  photos: Photo[];
  createdAt: string;
  updatedAt: string;
}

export interface PlaceDetail extends Place {
  services: ServiceAmenity[];
  socialLinks: SocialLink[];
  openingHours: OpeningHour[];
  promotions: Promotion[];
  articles: ArticleSummary[];
}

export interface Ranking {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  places: Array<{ place: Place; position: number }>;
}

export interface PlanazoEvent {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string | null;
  locationName: string | null;
  place: Place | null;
  status: ContentStatus;
}

export const PLACE_CATEGORY_SLUGS = ['comer', 'cafes', 'bares', 'cultura', 'aire-libre', 'tecnologia'] as const;
export type PlaceCategorySlug = (typeof PLACE_CATEGORY_SLUGS)[number];

/** Input to POST /cms/ai/generate-place — only what a human editor already knows. */
export interface PlaceDraftInput {
  name: string;
  hints?: string;
}

/** AI-generated draft — never includes address/phone/price; those are human-verified. */
export interface PlaceDraftOutput {
  description: string;
  suggestedCategory: PlaceCategorySlug;
  suggestedTags: string[];
}
