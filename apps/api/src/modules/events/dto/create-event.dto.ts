import { z } from 'zod';

export const createEventSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date().nullable().optional(),
  placeId: z.string().nullable().optional(),
  locationName: z.string().nullable().optional(),
  status: z.enum(['draft', 'in_review', 'scheduled', 'published', 'archived']).default('draft'),
  categoryData: z.record(z.string(), z.unknown()).optional(),
  seo: z
    .object({ title: z.string().optional(), description: z.string().optional(), canonical: z.string().optional(), ogImage: z.string().optional() })
    .nullable()
    .optional(),
});

export type CreateEventDto = z.infer<typeof createEventSchema>;
