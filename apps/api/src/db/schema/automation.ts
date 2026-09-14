import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { idColumn, createdAtColumn, updatedAtColumn } from './columns.helpers';

// Reglas que deciden qué temas de Content Radar se auto-publican solos en la
// corrida diaria (ver AutomationRunnerService) — sin regla activa que aplique,
// un tema nunca se toca automáticamente, solo aparece con su botón "Publicar"
// de siempre en Content Radar. `site`/`categorySlugs`/`contentTypes` vacíos o
// null significan "todos" — mismo criterio de "sin restricción = amplio" que
// ya usa categoryData en el resto del esquema.
export const automationRules = sqliteTable('automation_rules', {
  id: idColumn(),
  name: text('name').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  // null = ambos sitios.
  site: text('site', { enum: ['la-mira', 'planazo'] }),
  // Slugs de categorías del CMS (no de content-radar) — [] = todas las del sitio.
  categorySlugs: text('category_slugs', { mode: 'json' }).$type<string[]>().notNull().default([]),
  // Tipos de contenido permitidos (noticia/alerta/guia/evento/lugar/reportaje/
  // place/evento-planazo) — [] = todos los del sitio elegido.
  contentTypes: text('content_types', { mode: 'json' }).$type<string[]>().notNull().default([]),
  provider: text('provider', { enum: ['openai', 'claude-cli', 'codex-cli'] }).notNull().default('openai'),
  // Tope de publicaciones automáticas reales por corrida — protege contra
  // gastar todos los créditos de IA o inundar el sitio en una sola pasada.
  dailyLimit: integer('daily_limit').notNull().default(3),
  // Si el borrador queda corto (mismo check "calidad-longitud" de
  // checks.service.ts, no bloqueante para publicar solo pero sí señal de
  // texto flaco), le pide a la IA 1-3 secciones más antes de crear la pieza —
  // ver AutomationRunnerService.maybeExpandContent. Solo tiene efecto en
  // tipos con bloques de contenido reales (noticia/reportaje); place/alerta/
  // evento-planazo no traen `content` desde automation, no hay nada que
  // expandir ahí.
  expandIfShort: integer('expand_if_short', { mode: 'boolean' }).notNull().default(false),
  // Si la regla también procesa las frases reales de autocompletado de Google
  // ("Qué busca la gente (frases)" en el reporte de Content Radar) como
  // semillas de contenido — sin artículo que citar, la IA redacta directo
  // respondiendo la intención de búsqueda (ver AutomationRunnerService,
  // extractSearchPhrases en content-radar/render.ts). Apagado por default:
  // es una fuente más arriesgada que una noticia real con fuente.
  includeSearchPhrases: integer('include_search_phrases', { mode: 'boolean' }).notNull().default(false),
  createdAt: createdAtColumn(),
  updatedAt: updatedAtColumn(),
});

// Bitácora de cada tema que el runner evaluó — una fila por tema por corrida,
// independientemente del resultado, para que la pantalla de Automatizaciones
// pueda mostrar "qué hizo la IA anoche" sin adivinar a partir de `contentAuditLog`
// (que es por-pieza, no por-corrida-de-automatización).
export const automationRuns = sqliteTable('automation_runs', {
  id: idColumn(),
  ruleId: text('rule_id').references(() => automationRules.id, { onDelete: 'set null' }),
  // Copia del nombre al momento de la corrida — sobrevive si la regla se
  // borra o se renombra después, para que la bitácora siga siendo legible.
  ruleName: text('rule_name'),
  ranAt: createdAtColumn('ran_at'),
  topic: text('topic').notNull(),
  categoryLabel: text('category_label'),
  site: text('site', { enum: ['la-mira', 'planazo'] }),
  contentType: text('content_type'),
  // 'published': pasó los checks y se creó ya publicado.
  // 'draft': se creó pero como borrador (no pasó los checks — nunca se pierde,
  //          queda para revisión humana, ver contentId).
  // 'skipped_duplicate': el tema ya estaba marcado como publicado antes.
  // 'skipped_no_match': se generó el borrador pero la IA clasificó
  //          sitio/tipo/categoría fuera de lo que permite la regla, o el tipo
  //          no es automatizable (le faltan datos verificables) — no se creó nada.
  // 'error': algo falló generando el borrador o creando la pieza.
  outcome: text('outcome', {
    enum: ['published', 'draft', 'skipped_duplicate', 'skipped_no_match', 'error'],
  }).notNull(),
  // 'report': tema con artículo/fuente real de Content Radar (comportamiento
  // de siempre). 'search-phrase': vino de "Qué busca la gente (frases)" — una
  // frase de búsqueda real sin artículo que citar, la IA redacta directo
  // respondiendo la intención de búsqueda. Ver includeSearchPhrases arriba.
  source: text('source', { enum: ['report', 'search-phrase'] }).notNull().default('report'),
  contentId: text('content_id'),
  // Slug de la pieza creada — junto con `site`/`contentType`, arma la URL
  // pública real para el botón "Ver" cuando outcome es 'published' (ver
  // ViewPublishedLink / LAMIRA_TYPE_PATH en el CMS). Los borradores siguen
  // enlazando al editor del CMS, no al sitio, porque todavía no están vivos.
  contentSlug: text('content_slug'),
  detail: text('detail'),
});

// Fila única (ver AutomationRunnerService.run, siempre upsert del mismo id
// 'singleton') — "última vez que revisó", independiente de si encontró algo
// que publicar. La pantalla de Automatizaciones la usa para mostrar "sigue
// viva, revisó hace X minutos" sin ensuciar la bitácora de automation_runs
// (esa es solo resultados reales: publicado/borrador/descartado/error).
export const automationState = sqliteTable('automation_state', {
  id: text('id').primaryKey(),
  lastCheckedAt: createdAtColumn('last_checked_at'),
});

// Antes efímeras (se recalculaban leyendo el reporte del día en disco cada
// vez, ver AutomationRunnerService.extractTopics — ni siquiera llegaba a
// producción, apps/content-radar/reports/ está en .gitignore). Ahora se
// guardan de verdad la primera vez que se ven — dedupe por `phrase` — para
// poder acumular ligas de búsqueda web por frase y que el humano las revise
// en /automatizaciones/frases sin que desaparezcan al día siguiente.
export const searchPhrases = sqliteTable('search_phrases', {
  id: idColumn(),
  phrase: text('phrase').notNull().unique(),
  categoryLabel: text('category_label'),
  // 'pending': guardada, sin buscar ligas todavía.
  // 'researched': ya se corrió la búsqueda web, candidateLinks tiene resultados
  //          (puede quedar vacío si la búsqueda no encontró nada real).
  // 'used': el humano ya eligió una liga y mandó a generar el borrador desde
  //          Centro IA — se oculta de "Pendientes" para no acumular basura.
  // 'discarded': el humano decidió que esta frase no vale la pena.
  status: text('status', { enum: ['pending', 'researched', 'used', 'discarded'] }).notNull().default('pending'),
  // Resultados de Google Programmable Search — nunca los genera/inventa la
  // IA, siempre vienen de una búsqueda real (mismo principio que las
  // imágenes de Wikimedia/Openverse/Bing, ver ImageSearchService).
  candidateLinks: text('candidate_links', { mode: 'json' }).$type<{ title: string; url: string; snippet: string }[]>().notNull().default([]),
  researchedAt: integer('researched_at', { mode: 'timestamp' }),
  // Liga que el humano eligió al mandar a generar — solo referencia/auditoría,
  // el borrador real se genera en Centro IA (ver PublishFlow), no aquí.
  chosenUrl: text('chosen_url'),
  usedAt: integer('used_at', { mode: 'timestamp' }),
  createdAt: createdAtColumn(),
});

export type AutomationRuleRow = typeof automationRules.$inferSelect;
export type AutomationRunRow = typeof automationRuns.$inferSelect;
export type SearchPhraseRow = typeof searchPhrases.$inferSelect;
