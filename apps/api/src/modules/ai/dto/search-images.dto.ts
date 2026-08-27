import { z } from 'zod';

export const searchImagesSchema = z.object({
  query: z.string().min(1),
});

export type SearchImagesDto = z.infer<typeof searchImagesSchema>;
