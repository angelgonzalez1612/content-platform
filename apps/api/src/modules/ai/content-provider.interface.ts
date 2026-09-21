import type { z } from 'zod';
import { PLACE_CATEGORY_SLUGS, type PlaceDraftInput, type PlaceDraftOutput } from '@planazo/types';

export { PLACE_CATEGORY_SLUGS as CATEGORY_SLUGS };
export type { PlaceDraftInput, PlaceDraftOutput };

export interface StructuredGenerateInput<Schema extends z.ZodTypeAny> {
  systemPrompt: string;
  userPrompt: string;
  schema: Schema;
  schemaName: string;
}

export interface ConnectionCheckResult {
  ok: boolean;
  detail: string;
}

/**
 * Every LLM provider (OpenAI, Claude, Gemini, ...) implements this. Nothing
 * outside src/modules/ai should import a provider directly — only this
 * interface, via ContentProvider's injection token.
 */
export interface ContentProvider {
  generatePlaceDraft(input: PlaceDraftInput): Promise<PlaceDraftOutput>;
  /** Genérico, usado por el agente editorial (Fase 3) — cualquier tipo de
   * contenido + field_schema dinámico pasa por aquí, no por un método propio
   * por tipo. */
  generateStructured<Schema extends z.ZodTypeAny>(input: StructuredGenerateInput<Schema>): Promise<z.infer<Schema>>;
  /** Prueba real y barata (Configuración → Probar conexión) — nunca asume
   * "conectado" solo porque hay una key guardada o el CLI está en PATH: hace
   * la llamada mínima real que usaría una generación de verdad, para que un
   * ✓ aquí signifique que una regla con este proveedor va a funcionar. */
  checkConnection(): Promise<ConnectionCheckResult>;
}

export const CONTENT_PROVIDER = Symbol('CONTENT_PROVIDER');
