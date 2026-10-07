import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Último "parte de salud en Google" de cada sitio (tarjeta del Dashboard):
// sitemap, clics de la semana y una muestra de páginas inspeccionadas. Se
// guarda en la base porque calcularlo gasta cuota de la API de inspección
// (2,000 al día por propiedad) y tarda; se recalcula a lo más una vez al día.
export const searchConsoleHealth = sqliteTable('search_console_health', {
  site: text('site').primaryKey(),
  data: text('data', { mode: 'json' }).notNull(),
  checkedAt: integer('checked_at', { mode: 'timestamp' }).notNull(),
});
