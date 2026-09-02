import { z } from 'zod';

export const queryPlacesSchema = z.object({
  category: z.string().optional(),
  tag: z.string().optional(),
  alcaldiaSlug: z.string().optional(),
  // 200, no 100: planazo_fronted pide hasta 200 para traer el catálogo
  // completo de golpe (getPlaces() en lib/data/local.ts allá) — con el tope
  // anterior esa llamada SIEMPRE fallaba validación (400) y caía en
  // silencio al fixture local, sin que se notara (el catch de esa función
  // no distingue "falló de verdad" de "límite inválido").
  limit: z.coerce.number().int().min(1).max(200).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type QueryPlacesDto = z.infer<typeof queryPlacesSchema>;
