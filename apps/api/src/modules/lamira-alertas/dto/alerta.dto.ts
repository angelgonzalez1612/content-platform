import { z } from 'zod';

const seoSchema = z
  .object({ title: z.string().optional(), description: z.string().optional(), canonical: z.string().optional(), ogImage: z.string().optional() })
  .nullable()
  .optional();
const blockImageSchema = z.object({ url: z.string(), credit: z.string() }).nullable().optional();
const contentSchema = z.array(z.object({ heading: z.string().nullable().optional(), paragraphs: z.array(z.string()), image: blockImageSchema })).optional();

export const queryAlertasSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type QueryAlertasDto = z.infer<typeof queryAlertasSchema>;

export const createAlertaSchema = z.object({
  title: z.string().min(1),
  alertaStatus: z.enum(['activa', 'en-seguimiento', 'resuelta']),
  categoryId: z.string().nullable().optional(),
  alcaldiaSlug: z.string().nullable().optional(),
  description: z.string().min(1),
  updates: z.array(z.object({ time: z.string(), text: z.string() })).optional(),
  seo: seoSchema,
  imageUrl: z.string().nullable().optional(),
  imageCredit: z.string().nullable().optional(),
  categoryData: z.record(z.string(), z.unknown()).optional(),
  content: contentSchema,
});
export type CreateAlertaDto = z.infer<typeof createAlertaSchema>;

export const updateAlertaSchema = z
  .object({
    title: z.string().min(1).optional(),
    alertaStatus: z.enum(['activa', 'en-seguimiento', 'resuelta']).optional(),
    categoryId: z.string().nullable().optional(),
    alcaldiaSlug: z.string().nullable().optional(),
    description: z.string().min(1).optional(),
    updates: z.array(z.object({ time: z.string(), text: z.string() })).optional(),
    seo: seoSchema,
    imageUrl: z.string().nullable().optional(),
    imageCredit: z.string().nullable().optional(),
    categoryData: z.record(z.string(), z.unknown()).optional(),
    content: contentSchema,
  })
  .strict();
export type UpdateAlertaDto = z.infer<typeof updateAlertaSchema>;
