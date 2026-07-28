import { z } from 'zod';

export const createPlaceSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  categorySlug: z.string(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'in_review', 'published', 'archived']).default('draft'),
});

export type CreatePlaceDto = z.infer<typeof createPlaceSchema>;
