// Reglas de redacción: el mínimo que TODA pieza redactada con IA debe cumplir,
// en los dos sitios y en todos los tipos. Un solo lugar para que el prompt
// (lo que se le pide a la IA), el pipeline (lo que se valida al generar) y el
// Revisor (lo que se exige para publicar) nunca vuelvan a desalinearse — antes
// el prompt pedía 80-120 palabras a lugares/eventos mientras el Revisor exigía
// 300, y Planazo terminó con 160 fichas de ~110 palabras (AdSense rechazó
// ambos sitios por "contenido de poco valor").

export const WRITING_RULES = {
  /** Palabras mínimas del texto (bajada/descripción + cuerpo). */
  minWords: 300,
  /** Lo que se le pide a la IA: el mínimo es piso, no meta. */
  targetWords: 450,
  /** Secciones con subtítulo en el cuerpo. */
  minSections: 2,
  /** Rondas de "agregar secciones" si el borrador queda corto. */
  maxExpandRounds: 2,
} as const;

// Frases de relleno típicas de la IA cuando no tiene datos: dicen que no se
// sabe algo en vez de informar, o dejan ver el proceso de redacción ("el
// editor", "el texto proporcionado"). Publicadas, delatan una nota vacía.
export const FILLER_PATTERNS = [
  /la informaci[oó]n disponible no (precisa|detalla|incluye|permite|menciona)/i,
  /no es posible (establecer|confirmar|determinar|precisar)/i,
  /debe(n)? tomarse con cautela/i,
  /no se cuenta con (detalles|informaci[oó]n)/i,
  /sin (informaci[oó]n|detalles) adicional(es)?/i,
  /no (se )?(ha(n)? )?(detallado|precisado|confirmado) (qui[eé]n|cu[aá]ndo|d[oó]nde|c[oó]mo)/i,
  /conviene (esperar|consultar) (los )?(reportes|informaci[oó]n|publicaciones)/i,
  /sin atribuir causas que no est[aá]n confirmadas/i,
  /no se proporcion(ó|aron|a)/i,
  /el tema identificado/i,
  /\bel editor\b/i,
  /(texto|material|informaci[oó]n) proporcionad[oa]/i,
];

/** Cuántos patrones de relleno aparecen en el texto. */
export function fillerCount(text: string): number {
  return FILLER_PATTERNS.filter((re) => re.test(text)).length;
}

export const countWords = (text: string) => (text.match(/[\p{L}\p{N}]+/gu) ?? []).length;

type Block = { heading?: string | null; paragraphs?: string[] };
type GuideSection = { heading?: string; body?: string };

/**
 * El texto que lee la persona en un borrador de cualquier tipo: bajada o
 * descripción, intro, cuerpo en bloques, secciones de guía y FAQ. Sin SEO,
 * etiquetas ni campos de categoría — contar sobre el JSON completo inflaba
 * las palabras con llaves y metadatos.
 */
export function proseText(draft: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const key of ['dek', 'description', 'summary', 'intro'] as const) {
    if (typeof draft[key] === 'string') parts.push(draft[key]);
  }
  for (const b of (draft.content as Block[] | undefined) ?? []) parts.push(b.heading ?? '', ...(b.paragraphs ?? []));
  for (const s of (draft.sections as GuideSection[] | undefined) ?? []) parts.push(s.heading ?? '', s.body ?? '');
  for (const f of (draft.faq as { question?: string; answer?: string }[] | undefined) ?? []) parts.push(f.question ?? '', f.answer ?? '');
  return parts.filter(Boolean).join('\n');
}

export interface DraftQuality {
  ok: boolean;
  words: number;
  fillers: number;
  /** Motivo legible cuando no cumple (para la bitácora de automatización). */
  reason?: string;
}

/** ¿El borrador cumple las reglas de redacción? */
export function assessDraftQuality(draft: Record<string, unknown>): DraftQuality {
  const text = proseText(draft);
  const words = countWords(text);
  const fillers = fillerCount(text);
  const problems: string[] = [];
  if (words < WRITING_RULES.minWords) problems.push(`quedó en ${words} palabras (mínimo ${WRITING_RULES.minWords})`);
  if (fillers > 0) problems.push(`tiene ${fillers} frase(s) de relleno tipo "no se proporcionó…"`);
  return { ok: problems.length === 0, words, fillers, reason: problems.length ? `No cumplió las reglas de redacción: ${problems.join(' y ')}.` : undefined };
}

/** Se agrega al final del prompt de sistema de todos los tipos. */
export const WRITING_RULES_PROMPT = `Reglas de extensión y calidad (obligatorias — una pieza que no las cumpla se descarta):
- El texto completo (bajada o descripción + cuerpo) debe tener al menos ${WRITING_RULES.minWords} palabras; apunta a ${WRITING_RULES.targetWords} o más cuando la información lo permita.
- Organiza el cuerpo en al menos ${WRITING_RULES.minSections} secciones con subtítulo, cada una con un ángulo distinto.
- La extensión debe aportar: contexto, antecedentes, qué significa para quien vive o visita la Ciudad de México, qué hacer o qué sigue. Nunca alargues repitiendo ideas ni con frases genéricas.
- Nunca escribas que falta información ("la información disponible no precisa…", "no se proporcionaron…", "no es posible confirmar…") ni menciones al editor, "el texto proporcionado" o el proceso de redacción. Si un dato no está, no lo menciones y escribe sobre lo que sí se sabe.`;
