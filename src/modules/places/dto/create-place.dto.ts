import { z } from 'zod';

export const createPlaceSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  zone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  priceLevel: z.number().int().min(1).max(4).nullable().optional(),
  price: z.number().int().min(0).nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  categorySlug: z.string(),
  tags: z.array(z.string()).optional(),
  status: z.enum(['draft', 'in_review', 'published', 'archived']).default('draft'),
});

export type CreatePlaceDto = z.infer<typeof createPlaceSchema>;
