import { z } from 'zod';
import { AI_PROVIDER_IDS } from '../provider-registry.service';

// Botón "Generar SEO" del SeoPanel — para cuando el título/descripción SEO
// todavía están vacíos (contenido creado a mano, o un tipo que no pasa por el
// flujo de "Generar borrador"). Solo pide título/nombre de la pieza más un
// contexto corto opcional, no contentType/contentId — funciona igual antes o
// después de guardar.
export const generateSeoSchema = z.object({
  provider: z.enum(AI_PROVIDER_IDS).default('openai'),
  contentTitle: z.string().min(1),
  contentContext: z.string().optional(),
  instructions: z.string().optional(),
});

export type GenerateSeoDto = z.infer<typeof generateSeoSchema>;
