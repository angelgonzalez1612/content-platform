import { z } from 'zod';

const seoSchema = z
  .object({ title: z.string().optional(), description: z.string().optional(), canonical: z.string().optional(), ogImage: z.string().optional() })
  .nullable()
  .optional();

const KIND_VALUES = ['parque', 'plaza', 'museo', 'monumento', 'colonia', 'estacion-metro', 'estacion-metrobus'] as const;

export const queryLamiraLugaresSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type QueryLamiraLugaresDto = z.infer<typeof queryLamiraLugaresSchema>;

export const createLamiraLugarSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(KIND_VALUES),
  categoryId: z.string().nullable().optional(),
  alcaldiaSlug: z.string().min(1),
  colonia: z.string().nullable().optional(),
  description: z.string().min(1),
  seo: seoSchema,
  categoryData: z.record(z.string(), z.unknown()).optional(),
});
export type CreateLamiraLugarDto = z.infer<typeof createLamiraLugarSchema>;

export const updateLamiraLugarSchema = z
  .object({
    name: z.string().min(1).optional(),
    kind: z.enum(KIND_VALUES).optional(),
    categoryId: z.string().nullable().optional(),
    alcaldiaSlug: z.string().min(1).optional(),
    colonia: z.string().nullable().optional(),
    description: z.string().min(1).optional(),
    seo: seoSchema,
    categoryData: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type UpdateLamiraLugarDto = z.infer<typeof updateLamiraLugarSchema>;
