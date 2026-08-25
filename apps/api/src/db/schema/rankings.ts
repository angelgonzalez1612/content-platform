import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn } from './columns.helpers';
import { places } from './places';
import type { Seo } from '@planazo/types';

export const rankings = sqliteTable('rankings', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  categoryData: text('category_data', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  seo: text('seo', { mode: 'json' }).$type<Seo>(),
  createdAt: createdAtColumn(),
});

export const rankingPlaces = sqliteTable(
  'ranking_places',
  {
    rankingId: text('ranking_id')
      .notNull()
      .references(() => rankings.id, { onDelete: 'cascade' }),
    placeId: text('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
    position: integer('position').notNull(),
  },
  (t) => [primaryKey({ columns: [t.rankingId, t.placeId] })],
);
