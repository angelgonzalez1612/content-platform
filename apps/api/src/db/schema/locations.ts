import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { createdAtColumn } from './columns.helpers';

// Fuente única de las 16 alcaldías de CDMX + 19 municipios conurbados del
// Edomex (Zona Metropolitana del Valle de México) — antes esta misma lista
// vivía copiada a mano en 4 lugares (apps/cms, la-mira, planazo_fronted,
// content-radar), con riesgo real de desincronizarse entre ellos. El CMS y
// ambos sitios públicos (La Mira, Planazo) leen de aquí; content-radar sigue
// con su propia copia a propósito (necesita keywords de texto libre para
// clasificar notas, no solo el catálogo de nombres).
export const locations = sqliteTable('locations', {
  slug: text('slug').primaryKey(),
  name: text('name').notNull(),
  kind: text('kind', { enum: ['alcaldia', 'municipio'] }).notNull(),
  createdAt: createdAtColumn(),
});
