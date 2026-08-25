import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn } from './columns.helpers';
import { CONTENT_STATUS_VALUES } from './enums';
import { places } from './places';

export const articles = sqliteTable('articles', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  excerpt: text('excerpt'),
  content: text('content'),
  coverImageUrl: text('cover_image_url'),
  status: text('status', { enum: CONTENT_STATUS_VALUES })
    .default('draft')
    .notNull(),
  aiGenerated: integer('ai_generated', { mode: 'boolean' })
    .default(true)
    .notNull(),
  sourceKeyword: text('source_keyword'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  publishedAt: integer('published_at', { mode: 'timestamp' }),
  createdAt: createdAtColumn(),
  updatedAt: createdAtColumn('updated_at'),
});

export const articlePlaces = sqliteTable(
  'article_places',
  {
    articleId: text('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    placeId: text('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.placeId] })],
);
