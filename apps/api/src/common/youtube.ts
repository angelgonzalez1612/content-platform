import { z } from 'zod';

const ID = '([\\w-]{11})';
// Todas las formas reales de un link de YouTube: watch?v=, youtu.be/, /embed/
// (incl. youtube-nocookie), /shorts/, /live/ y /v/.
const PATTERNS = [
  new RegExp(`youtube(?:-nocookie)?\\.com/(?:embed|shorts|live|v)/${ID}`),
  new RegExp(`youtube\\.com/watch\\?(?:[^#]*&)?v=${ID}`),
  new RegExp(`youtu\\.be/${ID}`),
];

/** ID de 11 caracteres de un link de YouTube, o null si no es un video de YouTube. */
export function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  for (const re of PATTERNS) {
    const match = re.exec(url);
    if (match) return match[1];
  }
  return null;
}

/** Primer video de YouTube incrustado en el HTML de una página (iframe u og:video). */
export function findEmbeddedYoutubeId(html: string): string | null {
  const embed = /(?:src|content)=["']([^"']*youtube(?:-nocookie)?\.com\/(?:embed|v)\/[\w-]{11}[^"']*)["']/i.exec(html);
  return embed ? extractYoutubeId(embed[1]) : null;
}

/** Validación del campo youtubeId en los DTOs (el CMS ya manda el ID limpio). */
export const youtubeIdSchema = z
  .string()
  .regex(/^[\w-]{11}$/, 'ID de YouTube inválido')
  .nullable()
  .optional();

/**
 * Posición del video de la pieza DENTRO del cuerpo: va en el bloque que tenga
 * este campo, después del párrafo con ese índice (-1 = antes del primer
 * párrafo, justo bajo el encabezado). Ningún bloque con el campo = el video
 * queda en su lugar de siempre (bajo la imagen principal).
 */
export const blockVideoAfterSchema = z.number().int().min(-1).nullable().optional();
