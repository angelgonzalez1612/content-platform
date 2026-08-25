import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn } from './columns.helpers';
import { places } from './places';

export const rankings = sqliteTable('rankings', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
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
