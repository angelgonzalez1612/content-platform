import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn } from './columns.helpers';

// Historial de versiones — una fila por cada vez que se GUARDÓ un cambio real
// sobre una pieza (a mano o vía "Mejorar con IA" aplicado), con la foto
// completa de la fila principal ANTES de ese cambio. Polimórfico a propósito
// (sin FK dura), igual que content_audit_log: `contentId` apunta a una de
// ~9 tablas de contenido distintas, discriminado por `contentType`. Solo
// guarda las columnas propias de la fila principal — no relaciones aparte
// (fotos, tags, categorías): "Mejorar con IA" nunca las toca (ver
// improvePlace/improvePlanazoEvento en ai-draft.service.ts), así que
// restaurar una versión no necesita tocarlas tampoco.
export const contentVersions = sqliteTable('content_versions', {
  id: idColumn(),
  contentType: text('content_type').notNull(), // 'noticia' | 'place' | 'evento-planazo' | ...
  contentId: text('content_id').notNull(),
  // Quién/qué generó ESTE snapshot — no el actor del cambio que lo originó,
  // sino la razón de por qué se guardó (para mostrarlo en el historial).
  label: text('label').notNull(), // ej. "Antes de mejorar con IA", "Antes de editar a mano"
  snapshot: text('snapshot', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  createdAt: createdAtColumn(),
});
