import { z } from 'zod';
import { AI_PROVIDER_IDS } from '../provider-registry.service';

const blockImageSchema = z.object({ url: z.string(), credit: z.string() }).nullable().optional();
const contentBlockSchema = z.object({ heading: z.string().nullable().optional(), paragraphs: z.array(z.string()), image: blockImageSchema });

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
  // 'rewrite' (default): mejora descripción/SEO existentes, como siempre.
  // 'expand': escribe secciones NUEVAS de cuerpo (heading+paragraphs) para
  // agregar al final del contenido existente — no toca descripción/SEO.
  // Implementado para los 8 tipos (ver AiDraftService.improveContent).
  mode: z.enum(['rewrite', 'expand']).default('rewrite'),
});

export type ImproveRequestDto = z.infer<typeof improveRequestSchema>;

// Mismo "Agregar contenido" que improveRequestSchema (mode: 'expand'), pero
// ANTES de crear — en la pantalla de revisión de Centro IA no hay contentId
// todavía. El cliente manda el estado actual del borrador (nombre, resumen,
// bloques que la IA ya escribió si el tipo los tiene) en vez de un id; el
// servidor no lo guarda en BD ni en content_audit_log (igual que draft(), que
// tampoco audita — ver AiDraftService.draft).
export const draftExpandRequestSchema = z.object({
  contentType: z.string().min(1),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  content: z.array(contentBlockSchema).optional(),
  categoryId: z.string().nullable().optional(),
  instructions: z.string().optional(),
  provider: z.enum(AI_PROVIDER_IDS).default('openai'),
});

export type DraftExpandRequestDto = z.infer<typeof draftExpandRequestSchema>;
