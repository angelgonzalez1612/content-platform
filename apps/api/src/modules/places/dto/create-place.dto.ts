import { z } from 'zod';

const contentBlockSchema = z.object({
  heading: z.string().nullable().optional(),
  paragraphs: z.array(z.string()),
  image: z.object({ url: z.string(), credit: z.string() }).nullable().optional(),
});

export const createPlaceSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  zone: z.string().nullable().optional(),
  alcaldiaSlug: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  priceLevel: z.number().int().min(1).max(4).nullable().optional(),
  price: z.number().int().min(0).nullable().optional(),
  rating: z.number().min(0).max(5).nullable().optional(),
  categorySlug: z.string(),
  tags: z.array(z.string()).optional(),
  // Imagen inicial (de la fuente scrapeada, de una búsqueda de uso libre, o
  // pegada a mano) — antes de esto, `create()` nunca insertaba en `photos`,
  // así que un lugar creado con IA se quedaba sin imagen aunque el borrador
  // sí traía una (ver AiDraftService.draft, campo `image`, genérico para
  // cualquier tipo de contenido).
  photo: z
    .object({ url: z.string(), credit: z.string().nullable().optional() })
    .nullable()
    .optional(),
  status: z
    .enum(['draft', 'in_review', 'scheduled', 'published', 'archived'])
    .default('draft'),
  categoryData: z.record(z.string(), z.unknown()).optional(),
  // Cuerpo extendido opcional — no lo llena el draft inicial, se agrega
  // después desde "Mejorar con IA" (modo "Agregar contenido") en la edición.
  content: z.array(contentBlockSchema).optional(),
  // Si se puede abrir la foto en el modal de galería del sitio real —
  // apagado por defecto (ver schema/places.ts).
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
});

export type CreatePlaceDto = z.infer<typeof createPlaceSchema>;
