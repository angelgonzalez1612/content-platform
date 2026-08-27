import { z } from 'zod';

const seoSchema = z
  .object({ title: z.string().optional(), description: z.string().optional(), canonical: z.string().optional(), ogImage: z.string().optional() })
  .nullable()
  .optional();
const tocSchema = z.array(z.object({ id: z.string(), label: z.string() }));
const contentSchema = z.array(z.object({ heading: z.string().nullable().optional(), paragraphs: z.array(z.string()) }));

export const queryNoticiasSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type QueryNoticiasDto = z.infer<typeof queryNoticiasSchema>;

export const createNoticiaSchema = z.object({
  title: z.string().min(1),
  dek: z.string().min(1),
  categoryId: z.string().nullable().optional(),
  alcaldiaSlug: z.string().nullable().optional(),
  colonia: z.string().nullable().optional(),
  authorSlug: z.string().min(1),
  publishedAt: z.coerce.date().default(() => new Date()),
  readingTime: z.string().default('1 min'),
  status: z.enum(['draft', 'in_review', 'scheduled', 'published', 'archived']).default('draft'),
  sourceKind: z.string().nullable().optional(),
  externalSource: z.string().nullable().optional(),
  youtubeId: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  seo: seoSchema,
  toc: tocSchema.optional(),
  content: contentSchema.optional(),
  imageCaption: z.string().nullable().optional(),
  imageUrl: z.string().nullable().optional(),
  imageCredit: z.string().nullable().optional(),
  featured: z.boolean().optional(),
  tag: z.string().nullable().optional(),
  categoryData: z.record(z.string(), z.unknown()).optional(),
});
export type CreateNoticiaDto = z.infer<typeof createNoticiaSchema>;

export const updateNoticiaSchema = z
  .object({
    title: z.string().min(1).optional(),
    dek: z.string().min(1).optional(),
    categoryId: z.string().nullable().optional(),
    alcaldiaSlug: z.string().nullable().optional(),
    colonia: z.string().nullable().optional(),
    authorSlug: z.string().min(1).optional(),
    publishedAt: z.coerce.date().optional(),
    updatedAt: z.coerce.date().nullable().optional(),
    readingTime: z.string().optional(),
    status: z.enum(['draft', 'in_review', 'scheduled', 'published', 'archived']).optional(),
    sourceKind: z.string().nullable().optional(),
    externalSource: z.string().nullable().optional(),
    youtubeId: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    seo: seoSchema,
    toc: tocSchema.optional(),
    content: contentSchema.optional(),
    imageCaption: z.string().nullable().optional(),
    imageUrl: z.string().nullable().optional(),
    imageCredit: z.string().nullable().optional(),
    featured: z.boolean().optional(),
    tag: z.string().nullable().optional(),
    categoryData: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type UpdateNoticiaDto = z.infer<typeof updateNoticiaSchema>;
