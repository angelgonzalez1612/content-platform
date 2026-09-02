import { z } from 'zod';

const contentBlockSchema = z.object({
  heading: z.string().nullable().optional(),
  paragraphs: z.array(z.string()),
  image: z.object({ url: z.string(), credit: z.string() }).nullable().optional(),
});

export const updatePlaceSchema = z
  .object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
    zone: z.string().nullable().optional(),
    alcaldiaSlug: z.string().nullable().optional(),
    address: z.string().nullable().optional(),
    priceLevel: z.number().int().min(1).max(4).nullable().optional(),
    price: z.number().int().min(0).nullable().optional(),
    rating: z.number().min(0).max(5).nullable().optional(),
    reviewCount: z.number().int().min(0).optional(),
    phone: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
    // Reemplaza la foto de portada (photos[0]) — `null` la quita, `undefined`
    // (campo ausente) la deja intacta. El resto de la galería, si la hay, no
    // se toca desde aquí (ver PlacesService.update).
    photo: z
      .object({ url: z.string(), credit: z.string().nullable().optional() })
      .nullable()
      .optional(),
    status: z
      .enum(['draft', 'in_review', 'scheduled', 'published', 'archived'])
      .optional(),
    categoryData: z.record(z.string(), z.unknown()).optional(),
    content: z.array(contentBlockSchema).optional(),
    allowPhotoModal: z.boolean().optional(),
    seo: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        canonical: z.string().optional(),
        ogImage: z.string().optional(),
      })
      .nullable()
      .optional(),
  })
  .strict();

export type UpdatePlaceDto = z.infer<typeof updatePlaceSchema>;
