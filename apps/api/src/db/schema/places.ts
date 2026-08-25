import { sqliteTable, text, real, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn } from './columns.helpers';
import { CONTENT_STATUS_VALUES } from './enums';
import { categories, tags, services } from './taxonomy';
import type { Seo } from '@planazo/types';

export const places = sqliteTable('places', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  /** Neighborhood/colonia — distinct from the full street address. */
  zone: text('zone'),
  // text, not real — matches Postgres numeric-without-mode's string return
  // type, which @planazo/types and places.service.ts already assume.
  latitude: text('latitude'),
  longitude: text('longitude'),
  address: text('address'),
  priceLevel: integer('price_level'),
  /** Actual MXN amount, when known — priceLevel alone ($/$$/$$$) isn't enough for the site's price label. */
  price: integer('price'),
  rating: real('rating'),
  reviewCount: integer('review_count').default(0).notNull(),
  phone: text('phone'),
  website: text('website'),
  status: text('status', { enum: CONTENT_STATUS_VALUES })
    .default('draft')
    .notNull(),
  // Campos extra según el field_schema de la categoría asignada (ej. si algún
  // día una categoría de Place quiere un campo propio). Vacío ({}) por defecto.
  categoryData: text('category_data', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  seo: text('seo', { mode: 'json' }).$type<Seo>(),
  createdAt: createdAtColumn(),
  updatedAt: createdAtColumn('updated_at'),
});

export const placeCategories = sqliteTable(
  'place_categories',
  {
    placeId: text('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    categoryId: text('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.categoryId] })],
);

export const placeTags = sqliteTable(
  'place_tags',
  {
    placeId: text('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    tagId: text('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.tagId] })],
);

export const placeServices = sqliteTable(
  'place_services',
  {
    placeId: text('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    serviceId: text('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.serviceId] })],
);

export const photos = sqliteTable('photos', {
  id: idColumn(),
  placeId: text('place_id')
    .notNull()
    .references(() => places.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  alt: text('alt'),
  position: integer('position').default(0).notNull(),
  createdAt: createdAtColumn(),
});

export const socialLinks = sqliteTable('social_links', {
  id: idColumn(),
  placeId: text('place_id')
    .notNull()
    .references(() => places.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  url: text('url').notNull(),
});

export const openingHours = sqliteTable('opening_hours', {
  id: idColumn(),
  placeId: text('place_id')
    .notNull()
    .references(() => places.id, { onDelete: 'cascade' }),
  dayOfWeek: integer('day_of_week').notNull(),
  // Stored as "HH:MM" text — SQLite has no native time type.
  opensAt: text('opens_at'),
  closesAt: text('closes_at'),
  closed: integer('closed', { mode: 'boolean' }).default(false).notNull(),
});
