import { z } from 'zod';

const seoSchema = z
  .object({ title: z.string().optional(), description: z.string().optional(), canonical: z.string().optional(), ogImage: z.string().optional() })
  .nullable()
  .optional();
const tocSchema = z.array(z.object({ id: z.string(), label: z.string() }));
const contentSchema = z.array(z.object({ heading: z.string().nullable().optional(), paragraphs: z.array(z.string()) }));

export const queryReportajesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type QueryReportajesDto = z.infer<typeof queryReportajesSchema>;

export const createReportajeSchema = z.object({
  title: z.string().min(1),
  dek: z.string().min(1),
  authorSlug: z.string().min(1),
  categoryId: z.string().nullable().optional(),
  publishedAt: z.coerce.date().default(() => new Date()),
  readingTime: z.string().default('1 min'),
  status: z.enum(['draft', 'in_review', 'scheduled', 'published', 'archived']).default('draft'),
  tags: z.array(z.string()).min(1),
  sourceKind: z.string().nullable().optional(),
  seo: seoSchema,
  imageCaption: z.string().min(1),
  imageUrl: z.string().nullable().optional(),
  imageCredit: z.string().nullable().optional(),
  toc: tocSchema.optional(),
  content: contentSchema.optional(),
  categoryData: z.record(z.string(), z.unknown()).optional(),
});
export type CreateReportajeDto = z.infer<typeof createReportajeSchema>;

export const updateReportajeSchema = z
  .object({
    title: z.string().min(1).optional(),
    dek: z.string().min(1).optional(),
    authorSlug: z.string().min(1).optional(),
    categoryId: z.string().nullable().optional(),
    publishedAt: z.coerce.date().optional(),
    readingTime: z.string().optional(),
    status: z.enum(['draft', 'in_review', 'scheduled', 'published', 'archived']).optional(),
    tags: z.array(z.string()).min(1).optional(),
    sourceKind: z.string().nullable().optional(),
    seo: seoSchema,
    imageCaption: z.string().min(1).optional(),
    imageUrl: z.string().nullable().optional(),
    imageCredit: z.string().nullable().optional(),
    toc: tocSchema.optional(),
    content: contentSchema.optional(),
    categoryData: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type UpdateReportajeDto = z.infer<typeof updateReportajeSchema>;
