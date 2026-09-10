import { z } from 'zod';

const guideImageSchema = z.object({ url: z.string(), alt: z.string(), credit: z.string() }).nullable().optional();

const guideSectionSchema = z.object({
  heading: z.string().min(1),
  body: z.string().min(1),
  placeSlug: z.string().nullable().optional(),
  eyebrow: z.string().nullable().optional(),
  time: z.string().nullable().optional(),
  order: z.number().nullable().optional(),
  image: guideImageSchema,
});

export const queryGuidesSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});
export type QueryGuidesDto = z.infer<typeof queryGuidesSchema>;

export const createGuideSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  type: z.string().nullable().optional(),
  intro: z.string().nullable().optional(),
  sections: z.array(guideSectionSchema).optional(),
  categoryLabel: z.string().min(1),
  readTime: z.string().min(1),
  imageUrl: z.string().nullable().optional(),
  imageAlt: z.string().nullable().optional(),
  imageCredit: z.string().nullable().optional(),
  excerpt: z.string().nullable().optional(),
  budget: z.string().nullable().optional(),
  duration: z.string().nullable().optional(),
  audience: z.array(z.string()).optional(),
  status: z.enum(['draft', 'in_review', 'scheduled', 'published', 'archived']).default('draft'),
});
export type CreateGuideDto = z.infer<typeof createGuideSchema>;

export const updateGuideSchema = z
  .object({
    title: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    type: z.string().nullable().optional(),
    intro: z.string().nullable().optional(),
    sections: z.array(guideSectionSchema).optional(),
    categoryLabel: z.string().min(1).optional(),
    readTime: z.string().min(1).optional(),
    imageUrl: z.string().nullable().optional(),
    imageAlt: z.string().nullable().optional(),
    imageCredit: z.string().nullable().optional(),
    excerpt: z.string().nullable().optional(),
    budget: z.string().nullable().optional(),
    duration: z.string().nullable().optional(),
    audience: z.array(z.string()).optional(),
    status: z.enum(['draft', 'in_review', 'scheduled', 'published', 'archived']).optional(),
  })
  .strict();
export type UpdateGuideDto = z.infer<typeof updateGuideSchema>;
