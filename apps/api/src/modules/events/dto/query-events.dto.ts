import { z } from 'zod';

export const queryEventsSchema = z.object({
  alcaldiaSlug: z.string().optional(),
  // 200 por el mismo motivo que query-places.dto.ts: planazo_fronted pide
  // hasta 200 para traer el catálogo completo de una vez.
  limit: z.coerce.number().int().min(1).max(200).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type QueryEventsDto = z.infer<typeof queryEventsSchema>;
