import { z } from 'zod';
import { ENTIDADES_CATEGORIES } from '../entidades-categories';

const categoryIds = ENTIDADES_CATEGORIES.map((c) => c.id) as [
  string,
  ...string[],
];

// Se busca por categoría (el keyword general del catálogo) O por una frase
// libre `q` (ej. una frase de Trends como "noticias hoy" que el editor quiere
// convertir en nota real). Al menos uno de los dos debe venir.
export const localSearchQuerySchema = z
  .object({
    place: z.string().min(1),
    category: z.enum(categoryIds).optional(),
    q: z.string().min(1).optional(),
  })
  .refine((v) => !!v.category || !!v.q, {
    message: 'Falta category o q',
  });
