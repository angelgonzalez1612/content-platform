import { z } from 'zod';

export const nearbyPlacesSchema = z.object({
  query: z.string().min(1),
});

export type NearbyPlacesDto = z.infer<typeof nearbyPlacesSchema>;
