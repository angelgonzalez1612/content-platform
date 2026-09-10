import { z } from 'zod';

// Solo estos 5 tipos pueden llegar a publicarse solos de principio a fin — los
// otros 3 (guia, evento y lugar de La Mira) requieren datos verificables que
// la IA nunca inventa (groupSlug, fecha/hora/lugar/organizador, alcaldía) y
// que no tienen un default razonable, así que ni siquiera se puede CREAR la
// fila sin un humano — no es una cuestión de "no autopublicar", es que la
// automatización no tiene con qué llenarlos. Ver AutomationRunnerService.
export const AUTOMATABLE_CONTENT_TYPES = ['noticia', 'alerta', 'reportaje', 'place', 'evento-planazo'] as const;

// Sin .default(...) a propósito — es la base que updateAutomationRuleSchema
// parte con .partial(), y Zod SÍ aplica el .default() de un campo cuando la
// llave viene ausente incluso bajo .partial() (no lo deja "sin tocar" como
// haría un PATCH real). Con .default() en el shape base, un PATCH parcial
// como {active:true} volvía categorySlugs/contentTypes a [] en vez de
// dejarlos intactos — bug real que borró los filtros de 12 reglas de
// automatización el 2026-09-07 (se activaron con {"active":true} y perdieron
// categorySlugs/contentTypes sin que nadie lo pidiera). automationRuleSchema
// (para crear) sí agrega sus propios .default(...) por separado, ya que ahí
// SÍ se quiere rellenar lo que el caller no mande.
const automationRuleShape = {
  name: z.string().min(1),
  active: z.boolean(),
  site: z.enum(['la-mira', 'planazo']).nullable().optional(),
  categorySlugs: z.array(z.string()),
  contentTypes: z.array(z.enum(AUTOMATABLE_CONTENT_TYPES)),
  provider: z.enum(['openai', 'claude-cli', 'codex-cli']),
  dailyLimit: z.coerce.number().int().min(1).max(50),
  expandIfShort: z.boolean(),
  includeSearchPhrases: z.boolean(),
};

export const automationRuleSchema = z.object(automationRuleShape).extend({
  active: z.boolean().default(true),
  categorySlugs: z.array(z.string()).default([]),
  contentTypes: z.array(z.enum(AUTOMATABLE_CONTENT_TYPES)).default([]),
  provider: z.enum(['openai', 'claude-cli', 'codex-cli']).default('claude-cli'),
  dailyLimit: z.coerce.number().int().min(1).max(50).default(3),
  expandIfShort: z.boolean().default(false),
  includeSearchPhrases: z.boolean().default(false),
});
export type AutomationRuleDto = z.infer<typeof automationRuleSchema>;

export const updateAutomationRuleSchema = z.object(automationRuleShape).partial().strict();
export type UpdateAutomationRuleDto = z.infer<typeof updateAutomationRuleSchema>;
