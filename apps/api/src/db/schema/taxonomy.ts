import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn } from './columns.helpers';

export const categories = sqliteTable('categories', {
  id: idColumn(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: createdAtColumn(),
});

export const tags = sqliteTable('tags', {
  id: idColumn(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: createdAtColumn(),
});

export const services = sqliteTable('services', {
  id: idColumn(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: createdAtColumn(),
});
