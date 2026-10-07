import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

// Tareas manuales del "Camino a AdSense" (pantalla del CMS): las que no se
// pueden comprobar solas (pedir indexación, validar correcciones en Search
// Console, pedir la revisión…). Una fila por tarea marcada; la lista de
// tareas vive en código (AdsensePlanService), aquí solo su estado.
export const adsensePlanTasks = sqliteTable('adsense_plan_tasks', {
  id: text('id').primaryKey(),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
  doneAt: integer('done_at', { mode: 'timestamp' }),
});
