import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { contentStatusEnum } from './enums';
import { places } from './places';

export const articles = pgTable('articles', {
  id: uuid('id').defaultRandom().primaryKey(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  excerpt: text('excerpt'),
  content: text('content'),
  coverImageUrl: text('cover_image_url'),
  status: contentStatusEnum('status').default('draft').notNull(),
  aiGenerated: boolean('ai_generated').default(true).notNull(),
  sourceKeyword: text('source_keyword'),
  seoTitle: text('seo_title'),
  seoDescription: text('seo_description'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const articlePlaces = pgTable(
  'article_places',
  {
    articleId: uuid('article_id')
      .notNull()
      .references(() => articles.id, { onDelete: 'cascade' }),
    placeId: uuid('place_id')
      .notNull()
      .references(() => places.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.articleId, t.placeId] })],
);
