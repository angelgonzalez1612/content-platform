import { z } from 'zod';

export const searchImagesSchema = z.object({
  query: z.string().min(1),
});

export type SearchImagesDto = z.infer<typeof searchImagesSchema>;

// Sugerencias de búsqueda con IA: a partir del título (y opcionalmente un
// poco de contexto) la IA propone qué buscar — no genera imágenes.
export const imageQueriesSchema = z.object({
  title: z.string().min(1).max(300),
  context: z.string().max(1000).optional(),
});
