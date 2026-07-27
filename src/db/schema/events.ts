import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';
import { contentStatusEnum } from './enums';
import { places } from './places';

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  startDate: timestamp('start_date', { withTimezone: true }).notNull(),
  endDate: timestamp('end_date', { withTimezone: true }),
  placeId: uuid('place_id').references(() => places.id, {
    onDelete: 'set null',
  }),
  locationName: text('location_name'),
  status: contentStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const promotions = pgTable('promotions', {
  id: uuid('id').defaultRandom().primaryKey(),
  placeId: uuid('place_id')
    .notNull()
    .references(() => places.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  description: text('description'),
  discountLabel: text('discount_label'),
  startDate: timestamp('start_date', { withTimezone: true }),
  endDate: timestamp('end_date', { withTimezone: true }),
  status: contentStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});
