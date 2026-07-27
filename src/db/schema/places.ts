import {
  pgTable,
  uuid,
  text,
  timestamp,
  numeric,
  smallint,
  integer,
  boolean,
  time,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { contentStatusEnum } from './enums';
import { categories, tags, services } from './taxonomy';

export const places = pgTable('places', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  latitude: numeric('latitude', { precision: 9, scale: 6 }),
  longitude: numeric('longitude', { precision: 9, scale: 6 }),
  address: text('address'),
  priceLevel: smallint('price_level'),
  phone: text('phone'),
  website: text('website'),
  status: contentStatusEnum('status').default('draft').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const placeCategories = pgTable(
  'place_categories',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id')
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.categoryId] })],
);

export const placeTags = pgTable(
  'place_tags',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    tagId: uuid('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.tagId] })],
);

export const placeServices = pgTable(
  'place_services',
  {
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    serviceId: uuid('service_id')
      .notNull()
      .references(() => services.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.placeId, t.serviceId] })],
);

export const photos = pgTable('photos', {
  id: uuid('id').defaultRandom().primaryKey(),
  placeId: uuid('place_id')
    .notNull()
    .references(() => places.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  alt: text('alt'),
  position: integer('position').default(0).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const socialLinks = pgTable('social_links', {
  id: uuid('id').defaultRandom().primaryKey(),
  placeId: uuid('place_id')
    .notNull()
    .references(() => places.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  url: text('url').notNull(),
});

export const openingHours = pgTable('opening_hours', {
  id: uuid('id').defaultRandom().primaryKey(),
  placeId: uuid('place_id')
    .notNull()
    .references(() => places.id, { onDelete: 'cascade' }),
  dayOfWeek: smallint('day_of_week').notNull(),
  opensAt: time('opens_at'),
  closesAt: time('closes_at'),
  closed: boolean('closed').default(false).notNull(),
});
