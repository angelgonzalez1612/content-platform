import { z } from 'zod';

const fieldSchemaEntrySchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  type: z.enum(['text', 'textarea', 'number', 'boolean', 'date', 'select', 'multiselect']),
  required: z.boolean().optional(),
  isFact: z.boolean().optional(),
  options: z.array(z.string()).optional(),
});

export const updateCategorySchema = z
  .object({
    name: z.string().min(1).optional(),
    siteId: z.string().nullable().optional(),
    fieldSchema: z.array(fieldSchemaEntrySchema).optional(),
  })
  .strict();

export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;
