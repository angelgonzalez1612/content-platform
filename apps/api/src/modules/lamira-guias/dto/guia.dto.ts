import { z } from 'zod';

const seoSchema = z
  .object({ title: z.string().optional(), description: z.string().optional(), canonical: z.string().optional(), ogImage: z.string().optional() })
  .nullable()
  .optional();

export const queryGuiasSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type QueryGuiasDto = z.infer<typeof queryGuiasSchema>;

export const createGuiaSchema = z.object({
  title: z.string().min(1),
  dek: z.string().min(1),
  groupSlug: z.string().min(1),
  categoryId: z.string().nullable().optional(),
  readingTime: z.string().default('1 min'),
  status: z.enum(['draft', 'in_review', 'scheduled', 'published', 'archived']).default('draft'),
  officialSource: z.object({ label: z.string(), url: z.string() }).nullable().optional(),
  quickFacts: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
  seo: seoSchema,
  toc: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
  content: z.array(z.object({ id: z.string(), heading: z.string(), paragraphs: z.array(z.string()) })).optional(),
  faq: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
  categoryData: z.record(z.string(), z.unknown()).optional(),
});
export type CreateGuiaDto = z.infer<typeof createGuiaSchema>;

export const updateGuiaSchema = z
  .object({
    title: z.string().min(1).optional(),
    dek: z.string().min(1).optional(),
    groupSlug: z.string().min(1).optional(),
    categoryId: z.string().nullable().optional(),
    readingTime: z.string().optional(),
    status: z.enum(['draft', 'in_review', 'scheduled', 'published', 'archived']).optional(),
    officialSource: z.object({ label: z.string(), url: z.string() }).nullable().optional(),
    quickFacts: z.array(z.object({ label: z.string(), value: z.string() })).optional(),
    seo: seoSchema,
    toc: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
    content: z.array(z.object({ id: z.string(), heading: z.string(), paragraphs: z.array(z.string()) })).optional(),
    faq: z.array(z.object({ question: z.string(), answer: z.string() })).optional(),
    categoryData: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type UpdateGuiaDto = z.infer<typeof updateGuiaSchema>;
