import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { idColumn } from './columns.helpers';
import { CONTENT_STATUS_VALUES } from './enums';
import { sites } from './sites';
import { categories } from './taxonomy';
import { users } from './users';

interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
}

// Auditoría de cada corrida del agente editorial de IA — la única forma de
// responder "por qué se publicó esto solo" más adelante. `contentId` es
// polimórfico a propósito (sin FK dura): apunta a una de ~10 tablas de
// contenido distintas, discriminado por `contentType`. Ver Fase 1 del plan.
export const contentAuditLog = sqliteTable('content_audit_log', {
  id: idColumn(),
  siteId: text('site_id')
    .notNull()
    .references(() => sites.id),
  contentType: text('content_type').notNull(), // 'noticia' | 'place' | 'evento' | ...
  contentId: text('content_id').notNull(),
  categoryId: text('category_id').references(() => categories.id),
  mode: text('mode').notNull(), // 'draft' | 'improve'
  sourceContext: text('source_context', { mode: 'json' }).$type<Record<string, unknown>>(),
  // Campos isFact:true ANTES de esta corrida — base del check de seguridad de hechos.
  inputFacts: text('input_facts', { mode: 'json' }).$type<Record<string, unknown>>(),
  aiModel: text('ai_model').notNull(),
  aiOutput: text('ai_output', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  // TODOS los checks corridos, no solo el que falló — para auditar después
  // qué reglas existían en ese momento aunque cambien más adelante.
  checksRun: text('checks_run', { mode: 'json' }).$type<CheckResult[]>().notNull().default([]),
  decision: text('decision').notNull(), // 'auto-published' | 'needs-review' | 'human-published' | 'discarded'
  statusBefore: text('status_before', { enum: CONTENT_STATUS_VALUES }), // null en modo 'draft'
  statusAfter: text('status_after', { enum: CONTENT_STATUS_VALUES }).notNull(),
  actorId: text('actor_id').references(() => users.id), // null si la corrida fue 100% automática
  reviewedBy: text('reviewed_by').references(() => users.id),
  reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
  tokensUsed: integer('tokens_used'),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
});
