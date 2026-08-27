import { z } from 'zod';

const seoSchema = z
  .object({ title: z.string().optional(), description: z.string().optional(), canonical: z.string().optional(), ogImage: z.string().optional() })
  .nullable()
  .optional();

export const queryLamiraEventosSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
export type QueryLamiraEventosDto = z.infer<typeof queryLamiraEventosSchema>;

export const createLamiraEventoSchema = z.object({
  title: z.string().min(1),
  tag: z.string().min(1),
  categoryId: z.string().nullable().optional(),
  eventoStatus: z.enum(['proximo', 'en-curso', 'finalizado', 'cancelado']),
  date: z.string().min(1),
  time: z.string().min(1),
  location: z.string().min(1),
  alcaldiaSlug: z.string().nullable().optional(),
  price: z.string().min(1),
  description: z.string().min(1),
  organizer: z.string().min(1),
  officialUrl: z.string().nullable().optional(),
  seo: seoSchema,
  imageUrl: z.string().nullable().optional(),
  imageCredit: z.string().nullable().optional(),
  categoryData: z.record(z.string(), z.unknown()).optional(),
});
export type CreateLamiraEventoDto = z.infer<typeof createLamiraEventoSchema>;

export const updateLamiraEventoSchema = z
  .object({
    title: z.string().min(1).optional(),
    tag: z.string().min(1).optional(),
    categoryId: z.string().nullable().optional(),
    eventoStatus: z.enum(['proximo', 'en-curso', 'finalizado', 'cancelado']).optional(),
    date: z.string().min(1).optional(),
    time: z.string().min(1).optional(),
    location: z.string().min(1).optional(),
    alcaldiaSlug: z.string().nullable().optional(),
    price: z.string().min(1).optional(),
    description: z.string().min(1).optional(),
    organizer: z.string().min(1).optional(),
    officialUrl: z.string().nullable().optional(),
    seo: seoSchema,
    imageUrl: z.string().nullable().optional(),
    imageCredit: z.string().nullable().optional(),
    categoryData: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type UpdateLamiraEventoDto = z.infer<typeof updateLamiraEventoSchema>;
