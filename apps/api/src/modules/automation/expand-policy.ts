import type { ContentBlock } from '@planazo/types';
import { WRITING_RULES } from '../ai/writing-rules';

// Lugares y eventos de Planazo: el prompt editorial pide una descripción corta
// (80-120 palabras) y el mínimo de calidad-longitud es 60, así que la
// expansión "si queda corto" de noticia/reportaje nunca se disparaba y todas
// las piezas salían cortas. Aquí "corto" se mide contra un objetivo propio:
// descripción + secciones extra. Con "Agregar más contenido" activo en la
// regla, debajo de esto se piden 1-3 secciones nuevas.
export const PLANAZO_EXPAND_TARGET_WORDS: Record<string, number> = {
  place: WRITING_RULES.minWords,
  'evento-planazo': WRITING_RULES.minWords,
};

export function countWords(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

export function planazoNeedsExpansion(contentType: string, description: string | null | undefined, content: ContentBlock[] | null | undefined): boolean {
  const target = PLANAZO_EXPAND_TARGET_WORDS[contentType];
  if (!target) return false;
  const body = [description ?? '', ...(content ?? []).flatMap((b) => [b.heading ?? '', ...b.paragraphs])].join(' ');
  return countWords(body) < target;
}
