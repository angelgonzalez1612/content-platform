import { z } from 'zod';

export const queryPlacesSchema = z.object({
  category: z.string().optional(),
  tag: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type QueryPlacesDto = z.infer<typeof queryPlacesSchema>;
