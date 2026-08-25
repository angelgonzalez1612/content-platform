import { z } from 'zod';
import type { FieldSchemaEntry } from '@planazo/types';

// Arma un objeto Zod dinámico a partir del field_schema de una categoría —
// la pieza central de "cada categoría con su propio formato" (Fase 0/1).
// Deliberadamente separado del endpoint de IA (ver Fase 3 del plan: "es
// infraestructura nueva, no probada — prototipar aislado antes de conectarla").
//
// El structured-output de OpenAI (zodResponseFormat) es más estricto que un
// uso normal de Zod: no soporta uniones/records arbitrarios, y todo campo
// debe ser serializable a JSON Schema limpio. Por eso el mapeo de `type` es
// deliberadamente simple (sin regex, sin refine) — nada aquí debe generar
// una forma que OpenAI no pueda representar.
export function buildFieldSchemaZod(entries: FieldSchemaEntry[]) {
  const shape: Record<string, z.ZodTypeAny> = {};

  for (const entry of entries) {
    let field: z.ZodTypeAny;
    switch (entry.type) {
      case 'number':
        field = z.number();
        break;
      case 'boolean':
        field = z.boolean();
        break;
      case 'select':
        field = entry.options?.length ? z.enum(entry.options as [string, ...string[]]) : z.string();
        break;
      case 'multiselect':
        field = entry.options?.length ? z.array(z.enum(entry.options as [string, ...string[]])) : z.array(z.string());
        break;
      case 'date':
      case 'text':
      case 'textarea':
      default:
        field = z.string();
        break;
    }

    if (entry.label) field = field.describe(entry.label);
    // Los campos-hecho (isFact) SIEMPRE quedan opcionales/nulables en el
    // schema que ve el LLM — nunca se le exige "inventar" un valor. La
    // obligatoriedad real (required) se valida aparte, después, contra lo
    // que puso el humano o una fuente citada — no aquí.
    if (!entry.required || entry.isFact) {
      field = field.nullable().optional();
    }

    shape[entry.key] = field;
  }

  return z.object(shape);
}

/** Claves de field_schema marcadas isFact:true — el prompt debe decirle a la
 * IA explícitamente que nunca invente estos campos. */
export function factKeys(entries: FieldSchemaEntry[]): string[] {
  return entries.filter((e) => e.isFact).map((e) => e.key);
}
