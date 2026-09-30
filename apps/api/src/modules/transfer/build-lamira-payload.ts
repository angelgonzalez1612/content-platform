import { slugify } from '@planazo/shared';
import type { ContentBlock, Seo } from '@planazo/types';

export type LamiraTargetType = 'noticia' | 'reportaje' | 'alerta';

/** Lo que se lleva de un lugar/evento de Planazo a La Mira. */
export interface TransferSource {
  title: string;
  description: string;
  content: ContentBlock[];
  imageUrl: string | null;
  imageCredit: string | null;
  imagePosition: string | null;
  youtubeId: string | null;
  sourceUrl: string | null;
  seo: Seo | null;
}

const DEK_MAX = 220;
const WORDS_PER_MINUTE = 200;

/** Bajada: la primera oración de la descripción (recortada si es muy larga). */
export function dekFrom(description: string, fallback: string): string {
  const text = description.trim();
  if (!text) return fallback;
  const first = text.split(/(?<=[.!?])\s+/)[0] ?? text;
  if (first.length <= DEK_MAX) return first;
  const cut = first.slice(0, DEK_MAX);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 0 ? cut.lastIndexOf(' ') : DEK_MAX).trim()}…`;
}

function paragraphsOf(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/**
 * Convierte un lugar/evento de Planazo en el payload de creación del tipo de
 * La Mira elegido. Queda en revisión (noticia/reportaje) para que un humano
 * lo apruebe; la alerta no tiene estado en La Mira y se publica al crearse.
 */
export function buildLamiraPayload(source: TransferSource, targetType: LamiraTargetType, categoryId: string | null): Record<string, unknown> {
  const media = {
    imageUrl: source.imageUrl,
    imageCredit: source.imageCredit,
    imagePosition: source.imageUrl ? source.imagePosition : null,
    youtubeId: source.youtubeId,
  };
  const seo = source.seo && (source.seo.title || source.seo.description) ? source.seo : null;

  if (targetType === 'alerta') {
    return {
      title: source.title,
      alertaStatus: 'activa',
      categoryId,
      description: source.description.trim() || source.title,
      content: source.content,
      seo,
      ...media,
    };
  }

  // La descripción pasa a ser el primer bloque del cuerpo; luego las secciones.
  const intro = paragraphsOf(source.description);
  const content: ContentBlock[] = [...(intro.length ? [{ heading: null, paragraphs: intro }] : []), ...source.content];
  const words = content.flatMap((b) => [b.heading ?? '', ...b.paragraphs]).join(' ').split(/\s+/).filter(Boolean).length;
  const base = {
    title: source.title,
    dek: dekFrom(source.description, source.title),
    categoryId,
    authorSlug: 'redaccion-la-mira',
    readingTime: `${Math.max(1, Math.round(words / WORDS_PER_MINUTE))} min`,
    status: 'in_review',
    sourceUrl: source.sourceUrl,
    content,
    toc: content.filter((b) => b.heading?.trim()).map((b) => ({ id: slugify(b.heading!.trim()), label: b.heading!.trim() })),
    seo,
    ...media,
  };

  if (targetType === 'reportaje') {
    return { ...base, tags: ['Reportaje'], imageCaption: source.imageCredit || 'Pendiente' };
  }
  return base;
}
