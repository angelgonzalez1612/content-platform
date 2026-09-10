import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn } from './columns.helpers';
import { CONTENT_STATUS_VALUES } from './enums';
import type { GuideSection } from '@planazo/types';

// Editorial listicles/itinerarios de Planazo (ver GuideSection/PlanazoGuide en
// @planazo/types) — curan Places/PlanazoEvents reales por slug, a diferencia
// de `guias` (schema/lamira.ts), que es contenido narrativo propio de la-mira
// sin relación con el catálogo de lugares/eventos. Sin `siteId`: igual que
// `places`/`events`, Planazo no es multi-sitio todavía.
export const planazoGuides = sqliteTable('planazo_guides', {
  id: idColumn(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  // ContentType de planazo_fronted (guia/lista/plan/itinerario/comparacion/
  // agenda/temporada) — string libre aquí, el frontend es quien restringe
  // los valores válidos al leerlo.
  type: text('type'),
  intro: text('intro'),
  // `placeSlugs` NO se guarda aparte — se deriva de `sections[].placeSlug`
  // en el mapper (ver guides.mapper.ts). Ver el comentario en PlanazoGuide.
  sections: text('sections', { mode: 'json' })
    .$type<GuideSection[]>()
    .notNull()
    .default([]),
  categoryLabel: text('category_label').notNull(),
  readTime: text('read_time').notNull(),
  imageUrl: text('image_url'),
  imageAlt: text('image_alt'),
  imageCredit: text('image_credit'),
  excerpt: text('excerpt'),
  budget: text('budget'),
  duration: text('duration'),
  audience: text('audience', { mode: 'json' })
    .$type<string[]>()
    .notNull()
    .default([]),
  status: text('status', { enum: CONTENT_STATUS_VALUES })
    .default('draft')
    .notNull(),
  createdAt: createdAtColumn(),
  updatedAt: createdAtColumn('updated_at'),
});
