import { z } from 'zod';

export const updateEventSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().nullable().optional(),
    placeId: z.string().nullable().optional(),
    locationName: z.string().nullable().optional(),
    status: z.enum(['draft', 'in_review', 'scheduled', 'published', 'archived']).optional(),
    categoryData: z.record(z.string(), z.unknown()).optional(),
    seo: z
      .object({ title: z.string().optional(), description: z.string().optional(), canonical: z.string().optional(), ogImage: z.string().optional() })
      .nullable()
      .optional(),
  })
  .strict();

export type UpdateEventDto = z.infer<typeof updateEventSchema>;
