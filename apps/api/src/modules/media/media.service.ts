import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, isNotNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import * as schema from '../../db/schema';

export interface MediaItem {
  id: string;
  url: string;
  credit: string | null;
  alt: string | null;
  contentType: string;
  contentId: string;
  contentTitle: string;
  site: 'la-mira' | 'planazo';
}

// Catálogo real de imágenes en uso — no un sistema de archivos nuevo, es un
// índice sobre las imágenes que YA vive cada tipo de contenido: la imagen de
// portada de los 7 tipos con una sola columna imageUrl/imageCredit, más la
// galería real de `places` (varias fotos por lugar, tabla `photos`). Las
// imágenes embebidas dentro de bloques de contenido (ContentBlock.image) se
// quedan fuera de este primer corte — son opcionales y mucho menos comunes;
// se puede sumar después si hace falta.
@Injectable()
export class MediaService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async list(): Promise<MediaItem[]> {
    const [noticias, alertas, guias, lamiraEventos, lamiraLugares, reportajes, events, planazoGuides, photos] = await Promise.all([
      this.db
        .select({ id: schema.noticias.id, url: schema.noticias.imageUrl, credit: schema.noticias.imageCredit, title: schema.noticias.title })
        .from(schema.noticias)
        .where(isNotNull(schema.noticias.imageUrl)),
      this.db
        .select({ id: schema.alertas.id, url: schema.alertas.imageUrl, credit: schema.alertas.imageCredit, title: schema.alertas.title })
        .from(schema.alertas)
        .where(isNotNull(schema.alertas.imageUrl)),
      this.db
        .select({ id: schema.guias.id, url: schema.guias.imageUrl, credit: schema.guias.imageCredit, title: schema.guias.title })
        .from(schema.guias)
        .where(isNotNull(schema.guias.imageUrl)),
      this.db
        .select({ id: schema.lamiraEventos.id, url: schema.lamiraEventos.imageUrl, credit: schema.lamiraEventos.imageCredit, title: schema.lamiraEventos.title })
        .from(schema.lamiraEventos)
        .where(isNotNull(schema.lamiraEventos.imageUrl)),
      this.db
        .select({ id: schema.lamiraLugares.id, url: schema.lamiraLugares.imageUrl, credit: schema.lamiraLugares.imageCredit, title: schema.lamiraLugares.name })
        .from(schema.lamiraLugares)
        .where(isNotNull(schema.lamiraLugares.imageUrl)),
      this.db
        .select({ id: schema.reportajes.id, url: schema.reportajes.imageUrl, credit: schema.reportajes.imageCredit, title: schema.reportajes.title })
        .from(schema.reportajes)
        .where(isNotNull(schema.reportajes.imageUrl)),
      this.db
        .select({ id: schema.events.id, url: schema.events.imageUrl, credit: schema.events.imageCredit, title: schema.events.name })
        .from(schema.events)
        .where(isNotNull(schema.events.imageUrl)),
      this.db
        .select({ id: schema.planazoGuides.id, url: schema.planazoGuides.imageUrl, credit: schema.planazoGuides.imageCredit, title: schema.planazoGuides.title })
        .from(schema.planazoGuides)
        .where(isNotNull(schema.planazoGuides.imageUrl)),
      this.db
        .select({
          id: schema.photos.id,
          url: schema.photos.url,
          credit: schema.photos.credit,
          alt: schema.photos.alt,
          placeId: schema.photos.placeId,
          placeName: schema.places.name,
        })
        .from(schema.photos)
        .innerJoin(schema.places, eq(schema.photos.placeId, schema.places.id))
        .orderBy(asc(schema.photos.position)),
    ]);

    const tag = (
      rows: { id: string; url: string | null; credit: string | null; title: string }[],
      contentType: string,
      site: 'la-mira' | 'planazo',
    ): MediaItem[] =>
      rows
        .filter((r): r is typeof r & { url: string } => !!r.url)
        .map((r) => ({ id: r.id, url: r.url, credit: r.credit, alt: null, contentType, contentId: r.id, contentTitle: r.title, site }));

    const placePhotos: MediaItem[] = photos.map((p) => ({
      id: p.id,
      url: p.url,
      credit: p.credit,
      alt: p.alt,
      contentType: 'place',
      contentId: p.placeId,
      contentTitle: p.placeName,
      site: 'planazo',
    }));

    return [
      ...tag(noticias, 'noticia', 'la-mira'),
      ...tag(alertas, 'alerta', 'la-mira'),
      ...tag(guias, 'guia', 'la-mira'),
      ...tag(lamiraEventos, 'evento', 'la-mira'),
      ...tag(lamiraLugares, 'lugar', 'la-mira'),
      ...tag(reportajes, 'reportaje', 'la-mira'),
      ...tag(events, 'evento-planazo', 'planazo'),
      ...tag(planazoGuides, 'planazo-guia', 'planazo'),
      ...placePhotos,
    ];
  }
}
