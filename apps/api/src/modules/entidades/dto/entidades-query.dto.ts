import { z } from 'zod';
import { ENTIDADES_CATEGORIES } from '../entidades-categories';

const categoryIds = ENTIDADES_CATEGORIES.map((c) => c.id) as [
  string,
  ...string[],
];

export const interestQuerySchema = z.object({
  category: z.enum(categoryIds),
});

export const phrasesQuerySchema = z.object({
  category: z.enum(categoryIds),
  state: z.string().length(3),
});
