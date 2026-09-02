import { z } from 'zod';

export const markPublishedSchema = z.object({
  title: z.string().min(1),
  site: z.enum(['la-mira', 'planazo']).optional(),
  contentType: z.string().optional(),
  contentId: z.string().optional(),
});

export type MarkPublishedDto = z.infer<typeof markPublishedSchema>;
