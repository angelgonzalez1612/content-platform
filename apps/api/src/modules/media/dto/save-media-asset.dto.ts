import { z } from 'zod';

export const saveMediaAssetSchema = z.object({
  url: z.string().min(1),
  credit: z.string().nullable().optional(),
  source: z.enum(['wikimedia', 'openverse', 'bing']),
  sourcePageUrl: z.string().nullable().optional(),
  categoryId: z.string().nullable().optional(),
});
export type SaveMediaAssetDto = z.infer<typeof saveMediaAssetSchema>;
