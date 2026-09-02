import { z } from 'zod';

// Solo estos 5 tipos pueden llegar a publicarse solos de principio a fin — los
// otros 3 (guia, evento y lugar de La Mira) requieren datos verificables que
// la IA nunca inventa (groupSlug, fecha/hora/lugar/organizador, alcaldía) y
// que no tienen un default razonable, así que ni siquiera se puede CREAR la
// fila sin un humano — no es una cuestión de "no autopublicar", es que la
// automatización no tiene con qué llenarlos. Ver AutomationRunnerService.
export const AUTOMATABLE_CONTENT_TYPES = ['noticia', 'alerta', 'reportaje', 'place', 'evento-planazo'] as const;

export const automationRuleSchema = z.object({
  name: z.string().min(1),
  active: z.boolean().default(true),
  site: z.enum(['la-mira', 'planazo']).nullable().optional(),
  categorySlugs: z.array(z.string()).default([]),
  contentTypes: z.array(z.enum(AUTOMATABLE_CONTENT_TYPES)).default([]),
  provider: z.enum(['openai', 'claude-cli', 'codex-cli']).default('claude-cli'),
  dailyLimit: z.coerce.number().int().min(1).max(50).default(3),
  expandIfShort: z.boolean().default(false),
  includeSearchPhrases: z.boolean().default(false),
});
export type AutomationRuleDto = z.infer<typeof automationRuleSchema>;

export const updateAutomationRuleSchema = automationRuleSchema.partial().strict();
export type UpdateAutomationRuleDto = z.infer<typeof updateAutomationRuleSchema>;
