import { z } from 'zod';

// `null` = quitar la key guardada (vuelve a depender de OPENAI_API_KEY en
// apps/api/.env, si existe). String vacío no es válido — para "borrar" se
// manda null explícito, no "".
export const updateAiSettingsSchema = z.object({
  openaiApiKey: z.string().min(1).nullable(),
});
