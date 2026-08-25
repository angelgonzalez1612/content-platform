import { z } from 'zod';

export const updatePlaceSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    zone: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    priceLevel: z.number().int().min(1).max(4).nullable().optional(),
    price: z.number().int().min(0).nullable().optional(),
    rating: z.number().min(0).max(5).nullable().optional(),
    reviewCount: z.number().int().min(0).optional(),
    phone: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    status: z.enum(['draft', 'in_review', 'published', 'archived']).optional(),
  })
  .strict();

export type UpdatePlaceDto = z.infer<typeof updatePlaceSchema>;
