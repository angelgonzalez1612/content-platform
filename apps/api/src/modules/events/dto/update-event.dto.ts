import { z } from 'zod';

const blockImageSchema = z.object({ url: z.string(), credit: z.string() }).nullable().optional();
const contentSchema = z.array(z.object({ heading: z.string().nullable().optional(), paragraphs: z.array(z.string()), image: blockImageSchema })).optional();

export const updateEventSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    startDate: z.coerce.date().nullable().optional(),
    endDate: z.coerce.date().nullable().optional(),
    placeId: z.string().nullable().optional(),
    locationName: z.string().nullable().optional(),
    alcaldiaSlug: z.string().nullable().optional(),
    categoryId: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    imageCredit: z.string().nullable().optional(),
    status: z
      .enum(['draft', 'in_review', 'scheduled', 'published', 'archived'])
      .optional(),
    categoryData: z.record(z.string(), z.unknown()).optional(),
    seo: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        canonical: z.string().optional(),
        ogImage: z.string().optional(),
      })
      .nullable()
      .optional(),
    content: contentSchema,
  })
  .strict();

export type UpdateEventDto = z.infer<typeof updateEventSchema>;
