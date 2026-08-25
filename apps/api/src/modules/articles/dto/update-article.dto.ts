import { z } from 'zod';

export const updateArticleSchema = z
  .object({
    title: z.string().min(1).optional(),
    excerpt: z.string().nullable().optional(),
    content: z.string().nullable().optional(),
    coverImageUrl: z.string().nullable().optional(),
    status: z.enum(['draft', 'in_review', 'scheduled', 'published', 'archived']).optional(),
    sourceKeyword: z.string().nullable().optional(),
    seoTitle: z.string().nullable().optional(),
    seoDescription: z.string().nullable().optional(),
    canonicalUrl: z.string().nullable().optional(),
    ogImageUrl: z.string().nullable().optional(),
    categoryData: z.record(z.string(), z.unknown()).optional(),
    publishedAt: z.coerce.date().nullable().optional(),
  })
  .strict();

export type UpdateArticleDto = z.infer<typeof updateArticleSchema>;
