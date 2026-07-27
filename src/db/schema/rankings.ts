import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { places } from './places';

export const rankings = pgTable('rankings', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const rankingPlaces = pgTable(
  'ranking_places',
  {
    rankingId: uuid('ranking_id')
      .notNull()
      .references(() => rankings.id, { onDelete: 'cascade' }),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (t) => [primaryKey({ columns: [t.rankingId, t.placeId] })],
);
