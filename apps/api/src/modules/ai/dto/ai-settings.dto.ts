import { z } from 'zod';
import { AI_PROVIDER_IDS } from '../provider-registry.service';

// `null` = quitar la key guardada (vuelve a depender de OPENAI_API_KEY en
// apps/api/.env, si existe). String vacío no es válido — para "borrar" se
// manda null explícito, no "".
export const updateAiSettingsSchema = z.object({
  openaiApiKey: z.string().min(1).nullable(),
});

// `preferredProvider: null` = sin preferencia configurada (comportamiento de
// siempre: cada llamada usa el proveedor que se le pide, sin reintento).
// `fallbackProvider` solo tiene efecto cuando preferredProvider no es null —
// se guarda igual aunque venga solo, por si el editor configura el respaldo
// antes que el preferido.
export const updateProviderPreferenceSchema = z.object({
  preferredProvider: z.enum(AI_PROVIDER_IDS).nullable(),
  fallbackProvider: z.enum(AI_PROVIDER_IDS).nullable(),
});
