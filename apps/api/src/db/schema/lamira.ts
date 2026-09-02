import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn } from './columns.helpers';
import { CONTENT_STATUS_VALUES, ALERTA_STATUS_VALUES, EVENTO_STATUS_VALUES, LUGAR_KIND_VALUES } from './enums';
import { sites } from './sites';
import { categories } from './taxonomy';
import type { Seo, ContentBlock } from '@planazo/types';

// Los 6 tipos de contenido editorial de la-mira, reflejando 1:1 las
// interfaces ya definidas en la-mira/src/lib/types.ts (Noticia, Alerta,
// Guide, Evento, Lugar, Reportaje) — deliberadamente sin una interfaz base
// compartida, igual que el original (ver Fase 1 del plan de arquitectura).
// `categoryId` es la categoría unificada (Fase 0: 27 categorías); los campos
// slug/topic/group originales de cada tipo se preservan además donde tenían
// un significado propio distinto de "categoría" (ej. Guide.groupSlug).

interface TocEntry {
  id: string;
  label: string;
}

export const noticias = sqliteTable('noticias', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  dek: text('dek').notNull(),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  alcaldiaSlug: text('alcaldia_slug'),
  colonia: text('colonia'),
  authorSlug: text('author_slug').notNull(),
  publishedAt: integer('published_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
  readingTime: text('reading_time').notNull(),
  status: text('status', { enum: CONTENT_STATUS_VALUES }).default('draft').notNull(),
  sourceKind: text('source_kind'), // 'demo' | 'institucional' | 'editorial'
  externalSource: text('external_source'),
  // URL del artículo original citado (Milenio, Reforma, etc.) del que salió
  // el tema en Content Radar y con el que la IA redactó la pieza — capturada
  // sola cuando la crea la automatización (ver AiDraftService.draft /
  // AutomationRunnerService.createContent), editable a mano en el formulario.
  sourceUrl: text('source_url'),
  youtubeId: text('youtube_id'),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]),
  seo: text('seo', { mode: 'json' }).$type<Seo>(),
  toc: text('toc', { mode: 'json' }).$type<TocEntry[]>().notNull().default([]),
  content: text('content', { mode: 'json' }).$type<ContentBlock[]>().notNull().default([]),
  imageCaption: text('image_caption'),
  // Fase 4 del plan de rediseño del pipeline (content-radar → Centro IA):
  // imagen de la fuente original citada, con crédito — extraída del
  // og:image del artículo scrapeado (ArticleScraperService). Nullable: sigue
  // siendo válido crear contenido sin imagen (manual, o si el scraping falló).
  imageUrl: text('image_url'),
  imageCredit: text('image_credit'), // ej. "Foto: MILENIO"
  featured: integer('featured', { mode: 'boolean' }).default(false).notNull(),
  tag: text('tag'), // 'CLIMA' | 'DEPORTES' — badge suelto, distinto de categoryId
  categoryData: text('category_data', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAtColumn(),
});

export const alertas = sqliteTable('alertas', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  alertaStatus: text('alerta_status', { enum: ALERTA_STATUS_VALUES }).notNull(),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  alcaldiaSlug: text('alcaldia_slug'),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  description: text('description').notNull(),
  updates: text('updates', { mode: 'json' }).$type<{ time: string; text: string }[]>().notNull().default([]),
  // Nuevo respecto al original — Alerta no tenía seo. Ver Fase 5 del plan.
  seo: text('seo', { mode: 'json' }).$type<Seo>(),
  imageUrl: text('image_url'), // Fase 4 — ver comentario en noticias arriba.
  imageCredit: text('image_credit'),
  categoryData: text('category_data', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  // Cuerpo extendido opcional — mismo patrón que noticias/reportajes/places
  // (ver AiDraftService, modo 'expand'), agregado por un editor después del
  // draft inicial, nunca generado de entrada.
  content: text('content', { mode: 'json' }).$type<ContentBlock[]>().notNull().default([]),
  createdAt: createdAtColumn(),
});

export const guias = sqliteTable('guias', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  dek: text('dek').notNull(),
  // Catálogo propio de la-mira (GuideGroup), distinto de categoryId a propósito.
  groupSlug: text('group_slug').notNull(),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(), // sin publishedAt, igual que el original
  readingTime: text('reading_time').notNull(),
  status: text('status', { enum: CONTENT_STATUS_VALUES }).default('draft').notNull(),
  officialSource: text('official_source', { mode: 'json' }).$type<{ label: string; url: string }>(),
  quickFacts: text('quick_facts', { mode: 'json' }).$type<{ label: string; value: string }[]>().notNull().default([]),
  seo: text('seo', { mode: 'json' }).$type<Seo>(),
  toc: text('toc', { mode: 'json' }).$type<TocEntry[]>().notNull().default([]),
  content: text('content', { mode: 'json' })
    .$type<{ id: string; heading: string; paragraphs: string[] }[]>()
    .notNull()
    .default([]),
  faq: text('faq', { mode: 'json' }).$type<{ question: string; answer: string }[]>().notNull().default([]),
  imageUrl: text('image_url'), // Fase 4 — ver comentario en noticias arriba.
  imageCredit: text('image_credit'),
  categoryData: text('category_data', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAtColumn(),
});

// Nombre de tabla `lamira_eventos` — distinto de `events` (la tabla de
// Planazo, con fecha/hora reales) porque el Evento original de la-mira usa
// fecha/hora/precio en texto libre, no timestamps estructurados.
export const lamiraEventos = sqliteTable('lamira_eventos', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  tag: text('tag').notNull(), // badge libre, ej. "GRATIS", "EXPO"
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  eventoStatus: text('evento_status', { enum: EVENTO_STATUS_VALUES }).notNull(),
  // Texto libre a propósito — igual que el original, no son timestamps reales.
  date: text('date').notNull(),
  time: text('time').notNull(),
  location: text('location').notNull(),
  alcaldiaSlug: text('alcaldia_slug'),
  price: text('price').notNull(),
  description: text('description').notNull(),
  organizer: text('organizer').notNull(),
  officialUrl: text('official_url'),
  seo: text('seo', { mode: 'json' }).$type<Seo>(),
  imageUrl: text('image_url'), // Fase 4 — ver comentario en noticias arriba.
  imageCredit: text('image_credit'),
  categoryData: text('category_data', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  content: text('content', { mode: 'json' }).$type<ContentBlock[]>().notNull().default([]),
  createdAt: createdAtColumn(),
});

// Nombre de tabla `lamira_lugares` — distinto de `places` (Planazo) porque
// son catálogos conceptualmente distintos (parques/museos/estaciones vs.
// negocios con precio/horario/reseñas).
export const lamiraLugares = sqliteTable('lamira_lugares', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  name: text('name').notNull(), // no "title" — igual que el original
  kind: text('kind', { enum: LUGAR_KIND_VALUES }).notNull(),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  alcaldiaSlug: text('alcaldia_slug').notNull(), // requerido, único tipo donde lo es
  colonia: text('colonia'),
  description: text('description').notNull(),
  // Nuevo respecto al original — Lugar no tenía seo. Ver Fase 5 del plan.
  seo: text('seo', { mode: 'json' }).$type<Seo>(),
  imageUrl: text('image_url'), // Fase 4 — ver comentario en noticias arriba.
  imageCredit: text('image_credit'),
  categoryData: text('category_data', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  content: text('content', { mode: 'json' }).$type<ContentBlock[]>().notNull().default([]),
  createdAt: createdAtColumn(),
});

export const reportajes = sqliteTable('reportajes', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  dek: text('dek').notNull(),
  authorSlug: text('author_slug').notNull(),
  // El original no tenía categorySlug (solo tags) — se agrega para engancharlo
  // a la taxonomía unificada; queda nullable para no forzarlo.
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  publishedAt: integer('published_at', { mode: 'timestamp' }).notNull(),
  readingTime: text('reading_time').notNull(),
  status: text('status', { enum: CONTENT_STATUS_VALUES }).default('draft').notNull(),
  tags: text('tags', { mode: 'json' }).$type<string[]>().notNull().default([]), // requerido en el original
  sourceKind: text('source_kind'),
  sourceUrl: text('source_url'), // ver comentario en noticias arriba.
  seo: text('seo', { mode: 'json' }).$type<Seo>(),
  imageCaption: text('image_caption').notNull(),
  imageUrl: text('image_url'), // Fase 4 — ver comentario en noticias arriba.
  imageCredit: text('image_credit'),
  toc: text('toc', { mode: 'json' }).$type<TocEntry[]>().notNull().default([]),
  content: text('content', { mode: 'json' }).$type<ContentBlock[]>().notNull().default([]),
  categoryData: text('category_data', { mode: 'json' }).$type<Record<string, unknown>>().notNull().default({}),
  createdAt: createdAtColumn(),
});
