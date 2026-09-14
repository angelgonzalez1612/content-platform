import { z } from 'zod';
import { AI_PROVIDER_IDS } from '../provider-registry.service';

// Acotado a UN bloque del cuerpo (heading + paragraphs), no a todo el
// contenido — a diferencia de improveRequestSchema (ver ai.controller.ts
// improve/:type/:id), este endpoint no necesita contentType/contentId, solo
// el texto del bloque tal cual está en el formulario ahora mismo.
export const improveBlockSchema = z.object({
  provider: z.enum(AI_PROVIDER_IDS).default('openai'),
  // 'rewrite': corrige/mejora la redacción de los párrafos ya existentes.
  // 'expand': escribe 1-3 párrafos NUEVOS para agregar al final del bloque.
  mode: z.enum(['rewrite', 'expand']).default('rewrite'),
  heading: z.string().nullable().optional(),
  paragraphs: z.array(z.string()).min(1),
  instructions: z.string().optional(),
  // Contexto opcional (título del artículo completo) para que la IA no
  // repita lo que ya dice el resto — nunca se le pide reescribir eso.
  articleTitle: z.string().optional(),
});

export type ImproveBlockDto = z.infer<typeof improveBlockSchema>;
