import { z } from 'zod';

export const fetchImageSchema = z.object({
  url: z.string().url(),
});

export type FetchImageDto = z.infer<typeof fetchImageSchema>;
