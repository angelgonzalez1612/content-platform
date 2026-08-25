import { Injectable } from '@nestjs/common';
import type { Seo } from '@planazo/types';

export interface CheckResult {
  name: string;
  passed: boolean;
  detail?: string;
  /** No bloqueante = se marca "revisar" pero no impide auto-publicar (ver Fase 3 del plan). */
  blocking: boolean;
}

export interface RunChecksInput {
  mode: 'draft' | 'improve';
  /** Claves que deben existir y no estar vacías en draftData (base + category_data). */
  requiredFields: string[];
  /** Claves marcadas isFact:true — en modo "improve" deben coincidir exactamente con originalFacts. */
  factFields: string[];
  draftData: Record<string, unknown>;
  originalFacts?: Record<string, unknown>;
  seo?: Seo | null;
  hasImageWithAlt?: boolean;
  slugAvailable?: boolean;
  /** Para el chequeo de calidad (no bloqueante): texto principal a medir. */
  bodyText?: string;
}

export type AiDecision = 'auto-published' | 'needs-review';

export interface RunChecksResult {
  checksRun: CheckResult[];
  decision: AiDecision;
}

const isEmpty = (value: unknown) =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

// Determinístico, sin llamadas a LLM — es lo único que permite confiar en la
// auto-publicación (ver Fase 3 del plan). Corre TODOS los checks (no corta al
// primer fallo) para que content_audit_log guarde el panorama completo.
@Injectable()
export class ChecksService {
  run(input: RunChecksInput): RunChecksResult {
    const checksRun: CheckResult[] = [];

    // 1. Completitud de campos requeridos.
    const missing = input.requiredFields.filter((key) => isEmpty(input.draftData[key]));
    checksRun.push({
      name: 'completitud',
      passed: missing.length === 0,
      detail: missing.length ? `Faltan: ${missing.join(', ')}` : undefined,
      blocking: true,
    });

    // 2. Seguridad de hechos (solo aplica en modo "improve" — en "draft" no hay
    // originalFacts contra qué comparar, así que no hay nada que proteger todavía).
    if (input.mode === 'improve') {
      const changed = input.factFields.filter((key) => {
        const before = input.originalFacts?.[key];
        const after = input.draftData[key];
        // Si la IA no tocó el campo (undefined), no cuenta como cambio.
        return after !== undefined && JSON.stringify(before) !== JSON.stringify(after);
      });
      checksRun.push({
        name: 'seguridad-hechos',
        passed: changed.length === 0,
        detail: changed.length ? `Campos-hecho alterados sin aprobación humana: ${changed.join(', ')}` : undefined,
        blocking: true,
      });
    }

    // 3. SEO.
    const title = input.seo?.title;
    checksRun.push({
      name: 'seo-titulo',
      passed: !!title && title.length > 0 && title.length <= 60,
      detail: !title ? 'Falta seo.title' : title.length > 60 ? `${title.length} caracteres, máx. 60` : undefined,
      blocking: true,
    });

    const description = input.seo?.description;
    checksRun.push({
      name: 'seo-descripcion',
      passed: !!description && description.length >= 120 && description.length <= 160,
      detail: !description
        ? 'Falta seo.description'
        : `${description.length} caracteres, se espera 120-160`,
      blocking: true,
    });

    checksRun.push({
      name: 'slug-unico',
      passed: input.slugAvailable !== false,
      detail: input.slugAvailable === false ? 'El slug ya existe' : undefined,
      blocking: true,
    });

    checksRun.push({
      name: 'imagen-con-alt',
      passed: input.hasImageWithAlt !== false,
      detail: input.hasImageWithAlt === false ? 'Sin imagen con texto alternativo' : undefined,
      blocking: true,
    });

    // 4. Calidad — señal, no bloqueo. Un texto muy corto no impide publicar,
    // pero sí queda marcado para revisión periódica (ver riesgo #2 del plan).
    const wordCount = input.bodyText ? input.bodyText.trim().split(/\s+/).filter(Boolean).length : 0;
    checksRun.push({
      name: 'calidad-longitud',
      passed: wordCount >= 40,
      detail: `${wordCount} palabras (mínimo sugerido: 40)`,
      blocking: false,
    });

    const decision: AiDecision = checksRun.every((c) => !c.blocking || c.passed)
      ? 'auto-published'
      : 'needs-review';

    return { checksRun, decision };
  }
}
