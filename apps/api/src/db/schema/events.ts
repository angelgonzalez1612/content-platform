import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn } from './columns.helpers';
import { CONTENT_STATUS_VALUES } from './enums';
import { places } from './places';
import { categories } from './taxonomy';
import type { Seo } from '@planazo/types';

export const events = sqliteTable('events', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  startDate: integer('start_date', { mode: 'timestamp' }).notNull(),
  endDate: integer('end_date', { mode: 'timestamp' }),
  placeId: text('place_id').references(() => places.id, {
    onDelete: 'set null',
  }),
  // Nueva (2026-08-27): antes los eventos de Planazo no tenían categoría
  // propia — necesaria para que AiDraftService pueda clasificar/redactar
  // contra el mismo field_schema dinámico que ya usan place/la-mira.
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  locationName: text('location_name'),
  status: text('status', { enum: CONTENT_STATUS_VALUES })
    .default('draft')
    .notNull(),
  categoryData: text('category_data', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  seo: text('seo', { mode: 'json' }).$type<Seo>(),
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
