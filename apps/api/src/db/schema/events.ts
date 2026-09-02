import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn } from './columns.helpers';
import { CONTENT_STATUS_VALUES } from './enums';
import { places } from './places';
import { categories } from './taxonomy';
import type { Seo, ContentBlock } from '@planazo/types';

export const events = sqliteTable('events', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  // Nullable (2026-08-30): no todo lo que llega de content-radar es un evento
  // puntual con fecha/hora propia — un resumen tipo "agenda del fin de
  // semana" no tiene UNA fecha real, y forzarla obligaba a inventar una.
  // locationName ya era opcional; startDate era el único bloqueante real.
  startDate: integer('start_date', { mode: 'timestamp' }),
  endDate: integer('end_date', { mode: 'timestamp' }),
  placeId: text('place_id').references(() => places.id, {
    onDelete: 'set null',
  }),
  // Nueva (2026-08-27): antes los eventos de Planazo no tenían categoría
  // propia — necesaria para que AiDraftService pueda clasificar/redactar
  // contra el mismo field_schema dinámico que ya usan place/la-mira.
  categoryId: text('category_id').references(() => categories.id, {
    onDelete: 'set null',
  }),
  locationName: text('location_name'),
  /** Alcaldía de CDMX o municipio conurbado del Edomex — mismo catálogo y
   * mismos slugs que usa La Mira (ver apps/cms/src/lib/locations.ts). */
  alcaldiaSlug: text('alcaldia_slug'),
  // Imagen propia del evento — antes solo se mostraba la del `place`
  // vinculado (si tenía uno), o un placeholder genérico si no. Mismo patrón
  // de un solo campo url+crédito que ya usan los tipos de La Mira (a
  // diferencia de `places`, que modela una galería real en `photos`).
  imageUrl: text('image_url'),
  imageCredit: text('image_credit'),
  status: text('status', { enum: CONTENT_STATUS_VALUES })
    .default('draft')
    .notNull(),
  categoryData: text('category_data', { mode: 'json' })
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  seo: text('seo', { mode: 'json' }).$type<Seo>(),
  // Cuerpo extendido opcional — mismo patrón que places/noticias (ver
  // AiDraftService, modo 'expand'), agregado por un editor después del draft
  // inicial, nunca generado de entrada.
  content: text('content', { mode: 'json' }).$type<ContentBlock[]>().notNull().default([]),
  createdAt: createdAtColumn(),
});

export const promotions = sqliteTable('promotions', {
  id: idColumn(),
  placeId: text('place_id')
    .notNull()
    .references(() => places.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  discountLabel: text('discount_label'),
  startDate: integer('start_date', { mode: 'timestamp' }),
  endDate: integer('end_date', { mode: 'timestamp' }),
  status: text('status', { enum: CONTENT_STATUS_VALUES })
    .default('draft')
    .notNull(),
  createdAt: createdAtColumn(),
});
