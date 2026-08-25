import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn } from './columns.helpers';
import type { FieldSchemaEntry } from '@planazo/types';
import { sites } from './sites';

export const categories = sqliteTable('categories', {
  id: idColumn(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  // null = compartida entre sitios (ver Fase 0 del plan de arquitectura:
  // 15 exclusivas la-mira, 7 exclusivas Planazo, 5 compartidas).
  siteId: text('site_id').references(() => sites.id, { onDelete: 'set null' }),
  // Campos extra configurables por categoría (ej. "destino"/"duracion" para
  // Viajes, "linea"/"estacion" para Metro) — ver Fase 1 del plan para el
  // borrador completo de las 27 categorías. Vacío ([]) = sin campos extra.
  fieldSchema: text('field_schema', { mode: 'json' })
    .$type<FieldSchemaEntry[]>()
    .notNull()
    .default([]),
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
