import type { ContentBlock, Seo } from '@planazo/types';

export type PlanazoTargetType = 'place' | 'evento-planazo';

/** Lo que se lleva de una noticia/reportaje de La Mira a Planazo. */
export interface LamiraTransferSource {
  title: string;
  dek: string;
  content: ContentBlock[];
  imageUrl: string | null;
  imageCredit: string | null;
  imagePosition: string | null;
  youtubeId: string | null;
  sourceUrl: string | null;
  seo: Seo | null;
}

/**
 * Convierte una noticia/reportaje de La Mira en el payload de creación de un
 * lugar o evento de Planazo. En Planazo la descripción ES el texto principal:
 * se arma con la bajada y el primer bloque sin encabezado; el resto de las
 * secciones pasa como cuerpo extendido. Queda en revisión.
 */
export function buildPlanazoPayload(
  source: LamiraTransferSource,
  targetType: PlanazoTargetType,
  category: { id: string; slug: string },
): Record<string, unknown> {
  const [first, ...rest] = source.content;
  const leadIsIntro = !!first && !first.heading?.trim();
  const description = [source.dek.trim(), ...(leadIsIntro ? first.paragraphs : [])].filter(Boolean).join('\n\n');
  const content = leadIsIntro ? rest : source.content;
  const seo = source.seo && (source.seo.title || source.seo.description) ? source.seo : null;

  const common = {
    name: source.title,
    description: description || source.title,
    status: 'in_review',
    sourceUrl: source.sourceUrl,
    content,
    seo,
    youtubeId: source.youtubeId,
    imagePosition: source.imageUrl ? source.imagePosition : null,
  };

  if (targetType === 'place') {
    return {
      ...common,
      categorySlug: category.slug,
      photo: source.imageUrl ? { url: source.imageUrl, credit: source.imageCredit } : null,
    };
  }
  return {
    ...common,
    categoryId: category.id,
    imageUrl: source.imageUrl,
    imageCredit: source.imageCredit,
  };
}
