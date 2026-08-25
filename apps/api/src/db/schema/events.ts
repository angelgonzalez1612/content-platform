import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn } from './columns.helpers';
import { CONTENT_STATUS_VALUES } from './enums';
import { places } from './places';

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
  locationName: text('location_name'),
  status: text('status', { enum: CONTENT_STATUS_VALUES })
    .default('draft')
    .notNull(),
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
