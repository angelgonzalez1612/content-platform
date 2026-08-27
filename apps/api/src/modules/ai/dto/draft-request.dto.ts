import { z } from 'zod';
import { AI_PROVIDER_IDS } from '../provider-registry.service';

export const draftRequestSchema = z.object({
  // site/contentType opcionales: si se omiten AMBOS (flujo de Publicar desde
  // content-radar, que ya no fija el destino de antemano), AiDraftService los
  // clasifica juntos con IA (ver classifyContentType). Los flujos manuales del
  // CMS (SiteTabs → Centro IA de un sitio específico) los siguen mandando fijos.
  site: z.enum(['la-mira', 'planazo']).optional(),
  contentType: z.string().min(1).optional(),
  categoryId: z.string().min(1).optional(), // si se omite, la IA la clasifica sola (ver AiDraftService.classifyCategory)
  name: z.string().min(1),
  hints: z.string().optional(),
  provider: z.enum(AI_PROVIDER_IDS).default('openai'),
});

export type DraftRequestDto = z.infer<typeof draftRequestSchema>;

export const improveRequestSchema = z.object({
  instructions: z.string().optional(),
  provider: z.enum(AI_PROVIDER_IDS).default('openai'),
});

export type ImproveRequestDto = z.infer<typeof improveRequestSchema>;
