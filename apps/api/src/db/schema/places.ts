import {
  sqliteTable,
  text,
  real,
  integer,
  primaryKey,
} from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn } from './columns.helpers';
import { CONTENT_STATUS_VALUES } from './enums';
import { categories, tags, services } from './taxonomy';
import type { Seo, ContentBlock } from '@planazo/types';

export const places = sqliteTable('places', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  /** Neighborhood/colonia — distinct from the full street address. */
  zone: text('zone'),
  /** Alcaldía de CDMX o municipio conurbado del Edomex — mismo catálogo y
   * mismos slugs que usa La Mira (ver apps/cms/src/lib/locations.ts). */
  alcaldiaSlug: text('alcaldia_slug'),
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
  categoryData: text('category_data', { mode: 'json' })
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  seo: text('seo', { mode: 'json' }).$type<Seo>(),
  // Cuerpo extendido opcional — mismo shape {heading?, paragraphs[], image?}
  // que noticia/guia/reportaje de La Mira (ver schema/lamira.ts). La ficha
  // corta (`description`) sigue siendo el resumen; esto es contenido
  // adicional que un editor agrega después (ver AiDraftService.improvePlace,
  // modo 'expand') — nunca lo genera el draft inicial.
  content: text('content', { mode: 'json' })
    .$type<ContentBlock[]>()
    .notNull()
    .default([]),
  // Apagado por defecto a propósito — antes CUALQUIER foto abría el modal de
  // galería en el sitio real, aunque fuera una imagen genérica de banco. El
  // editor lo prende cuando la foto real del lugar amerita verse en grande.
  allowPhotoModal: integer('allow_photo_modal', { mode: 'boolean' })
    .notNull()
    .default(false),
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
  // Atribución real de la fuente (ej. "Foto: Wikimedia Commons — Autor X") —
  // separado de `alt` (texto de accesibilidad, ya usado como tal en las 15+
  // vistas reales de planazo_fronted) para no mezclar los dos conceptos.
  credit: text('credit'),
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
