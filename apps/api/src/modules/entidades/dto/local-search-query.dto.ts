import { z } from 'zod';
import { ENTIDADES_CATEGORIES } from '../entidades-categories';

const categoryIds = ENTIDADES_CATEGORIES.map((c) => c.id) as [
  string,
  ...string[],
];

export const localSearchQuerySchema = z.object({
  category: z.enum(categoryIds),
  place: z.string().min(1),
});
