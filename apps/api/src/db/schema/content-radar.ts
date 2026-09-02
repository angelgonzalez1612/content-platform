import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn } from './columns.helpers';

// Registra qué temas de Content Radar ya se publicaron — para que el botón
// "Publicar" del reporte se marque como hecho y no invite a duplicar el
// mismo tema dos veces. `title` es el mismo texto exacto que ya viaja en el
// deep-link `?name=` del botón (ver content-radar/render.ts,
// buildPublishButtons) — sirve de llave porque los reportes no traen un id
// estable propio por tema, solo el titular.
export const contentRadarPublished = sqliteTable('content_radar_published', {
  id: idColumn(),
  title: text('title').notNull().unique(),
  site: text('site'),
  contentType: text('content_type'),
  contentId: text('content_id'),
  createdAt: createdAtColumn(),
});
