import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn } from './columns.helpers';

export const sites = sqliteTable('sites', {
  id: idColumn(),
  slug: text('slug').notNull().unique(), // 'la-mira' | 'planazo'
  name: text('name').notNull(),
  domain: text('domain'),
  createdAt: createdAtColumn(),
});
