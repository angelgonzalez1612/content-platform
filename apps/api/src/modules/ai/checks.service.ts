import { Injectable } from '@nestjs/common';
import type { Seo, CheckResult, AiDecision } from '@planazo/types';

export type { CheckResult, AiDecision };

export interface RunChecksInput {
  mode: 'draft' | 'improve';
  /** Determina el umbral de `calidad-longitud` — ver MIN_WORDS_BY_TYPE. */
  contentType: string;
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

export interface RunChecksResult {
  checksRun: CheckResult[];
  decision: AiDecision;
}

const isEmpty = (value: unknown) =>
  value === null || value === undefined || (typeof value === 'string' && value.trim() === '');

// Umbral mínimo de `calidad-longitud` por tipo de contenido. 300 nació
// calibrado solo para noticia/reportaje (ver comentario más abajo) — aplicado
// tal cual a los tipos de nota corta (place/alerta/evento*/lugar), donde el
// propio prompt editorial en content-types.ts pide 1-3 párrafos o 80-120
// palabras, el check bloqueaba el 100% de las piezas sin excepción, sin
// importar qué tan buena fuera la redacción. guia sí se deja en 300: es
// evergreen con content[] + faq, con espacio real para llegar ahí.
const MIN_WORDS_BY_TYPE: Record<string, number> = {
  noticia: 300,
  reportaje: 300,
  guia: 300,
  place: 60, // objetivo editorial: 80-120 palabras (content-types.ts)
  alerta: 50, // objetivo editorial: 1-3 párrafos
  evento: 40, // objetivo editorial: 1-2 párrafos
  'evento-planazo': 40, // objetivo editorial: 1-2 párrafos
  lugar: 40, // objetivo editorial: 1-2 párrafos
};
const DEFAULT_MIN_WORDS = 300;

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
    // Tolerancia a 70 (no 60 estricto): 60 es la guía de libro de texto, pero
    // el corte real de Google es por ancho en píxeles (~600px), no por conteo
    // de caracteres — un título de 61-70 rara vez se trunca de verdad. Ver
    // Fase 6.5 del plan: con el límite estricto, prácticamente ningún título
    // generado por claude-cli (sin structured-output forzado) pasaba.
    const title = input.seo?.title;
    checksRun.push({
      name: 'seo-titulo',
      passed: !!title && title.length > 0 && title.length <= 70,
      detail: !title ? 'Falta seo.title' : title.length > 70 ? `${title.length} caracteres, máx. 70` : undefined,
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

    // 4. Calidad — bloqueante desde 2026-09-07 (calidad > cantidad mientras
    // se estabiliza el sitio para pasar la revisión de AdSense; antes era
    // señal no bloqueante, ver historial de este archivo). Umbral subido de
    // 40 a 300 el mismo día: con 40, artículos de 40-290 palabras (varios de
    // apenas 33-52 en producción) pasaban como "de calidad aceptable" y nunca
    // disparaban expandIfShort/maybeExpandContent — Google AdSense rechazó
    // ambos sitios por "contenido de poco valor", y ese volumen de piezas
    // demasiado cortas fue una causa real confirmada. Reversible a
    // blocking:false cuando se quiera volver a más auto-publicación.
    const wordCount = input.bodyText ? input.bodyText.trim().split(/\s+/).filter(Boolean).length : 0;
    const minWords = MIN_WORDS_BY_TYPE[input.contentType] ?? DEFAULT_MIN_WORDS;
    checksRun.push({
      name: 'calidad-longitud',
      passed: wordCount >= minWords,
      detail: `${wordCount} palabras (mínimo: ${minWords})`,
      blocking: true,
    });

    // 5. Revisión humana obligatoria para evento-planazo (2026-09-10): las
    // reglas de esa categoría (Gaming/Música/Geek/Cine-TV/Viajes/Eventos —
    // Planazo) generan borradores bien formados — pasan completitud/SEO/
    // longitud sin problema — a partir de temas que a veces son cobertura de
    // industria (ranking turístico, estudio de mercado), no una recomendación
    // real de plan con fecha/lugar. El classifyHint de evento-planazo en
    // content-types.ts ya dice "no para cobertura noticiosa", pero es una
    // instrucción para la IA, no algo que un check determinístico pueda
    // verificar todavía: `startDate` llega null incluso en piezas legítimas
    // (ver createContent en automation-runner.service.ts, nunca lo llena),
    // así que hoy no existe ninguna señal estructural real que distinga "es
    // un plan" de "es una noticia". Mientras no exista esa señal, todo
    // evento-planazo pasa por revisión humana sin excepción — mismo criterio
    // que ya se aplicó a calidad-longitud: calidad/seguridad > volumen
    // mientras se estabiliza el sitio para AdSense. Quitar este check en
    // cuanto haya una forma confiable de distinguir ambos casos.
    checksRun.push({
      name: 'revision-humana-evento-planazo',
      passed: input.contentType !== 'evento-planazo',
      detail: input.contentType === 'evento-planazo' ? 'evento-planazo siempre requiere revisión humana antes de publicar' : undefined,
      blocking: true,
    });

    const decision: AiDecision = checksRun.every((c) => !c.blocking || c.passed)
      ? 'auto-published'
      : 'needs-review';

    return { checksRun, decision };
  }
}
