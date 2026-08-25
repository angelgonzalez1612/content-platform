import { z } from 'zod';
import { AI_PROVIDER_IDS } from '../provider-registry.service';

export const draftRequestSchema = z.object({
  site: z.enum(['la-mira', 'planazo']),
  contentType: z.string().min(1),
  categoryId: z.string().min(1),
  name: z.string().min(1),
  hints: z.string().optional(),
  provider: z.enum(AI_PROVIDER_IDS).default('openai'),
});

export type DraftRequestDto = z.infer<typeof draftRequestSchema>;

export const improveRequestSchema = z.object({
  instructions: z.string().optional(),
  provider: z.enum(AI_PROVIDER_IDS).default('openai'),
});

export type ImproveRequestDto = z.infer<typeof improveRequestSchema>;
