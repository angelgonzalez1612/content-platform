import { z } from 'zod';

export const generatePlaceSchema = z.object({
  name: z.string().min(2),
  hints: z.string().optional(),
});

export type GeneratePlaceDto = z.infer<typeof generatePlaceSchema>;
