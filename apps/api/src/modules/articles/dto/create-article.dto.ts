import { z } from 'zod';

export const createArticleSchema = z.object({
  title: z.string().min(1),
  excerpt: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
  coverImageUrl: z.string().nullable().optional(),
  status: z.enum(['draft', 'in_review', 'scheduled', 'published', 'archived']).default('draft'),
  aiGenerated: z.boolean().default(true),
  sourceKeyword: z.string().nullable().optional(),
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  canonicalUrl: z.string().nullable().optional(),
  ogImageUrl: z.string().nullable().optional(),
  categoryData: z.record(z.string(), z.unknown()).optional(),
  placeIds: z.array(z.string()).optional(),
});

export type CreateArticleDto = z.infer<typeof createArticleSchema>;
