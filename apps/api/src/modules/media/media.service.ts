import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { asc, desc, eq, isNotNull } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import * as schema from '../../db/schema';
import { FtpStorageService } from './ftp-storage.service';
import type { SaveMediaAssetDto } from './dto/save-media-asset.dto';

export interface MediaAsset {
  id: string;
  url: string;
  credit: string | null;
  source: 'wikimedia' | 'openverse' | 'bing';
  sourcePageUrl: string | null;
  categoryName: string | null;
  createdAt: string;
}

export interface MediaItem {
  id: string;
  url: string;
  credit: string | null;
  alt: string | null;
  contentType: string;
  contentId: string;
  contentTitle: string;
  site: 'la-mira' | 'planazo';
  // Categoría editorial real (nombre, no id) — para poder filtrar "más
  // variedad en esta categoría" al buscar una imagen de reemplazo. null si
  // el contenido no tiene categoría asignada. `planazo-guia` no usa el
  // catálogo compartido (categoryLabel es texto libre, ver guide-form.tsx),
  // así que se usa esa etiqueta tal cual.
  categoryName: string | null;
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
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly ftpStorage: FtpStorageService,
  ) {}

  async list(): Promise<MediaItem[]> {
    const [noticias, alertas, guias, lamiraEventos, lamiraLugares, reportajes, events, planazoGuides, photos, placeCategoryRows] = await Promise.all([
      this.db
        .select({ id: schema.noticias.id, url: schema.noticias.imageUrl, credit: schema.noticias.imageCredit, title: schema.noticias.title, categoryName: schema.categories.name })
        .from(schema.noticias)
        .leftJoin(schema.categories, eq(schema.noticias.categoryId, schema.categories.id))
        .where(isNotNull(schema.noticias.imageUrl)),
      this.db
        .select({ id: schema.alertas.id, url: schema.alertas.imageUrl, credit: schema.alertas.imageCredit, title: schema.alertas.title, categoryName: schema.categories.name })
        .from(schema.alertas)
        .leftJoin(schema.categories, eq(schema.alertas.categoryId, schema.categories.id))
        .where(isNotNull(schema.alertas.imageUrl)),
      this.db
        .select({ id: schema.guias.id, url: schema.guias.imageUrl, credit: schema.guias.imageCredit, title: schema.guias.title, categoryName: schema.categories.name })
        .from(schema.guias)
        .leftJoin(schema.categories, eq(schema.guias.categoryId, schema.categories.id))
        .where(isNotNull(schema.guias.imageUrl)),
      this.db
        .select({
          id: schema.lamiraEventos.id,
          url: schema.lamiraEventos.imageUrl,
          credit: schema.lamiraEventos.imageCredit,
          title: schema.lamiraEventos.title,
          categoryName: schema.categories.name,
        })
        .from(schema.lamiraEventos)
        .leftJoin(schema.categories, eq(schema.lamiraEventos.categoryId, schema.categories.id))
        .where(isNotNull(schema.lamiraEventos.imageUrl)),
      this.db
        .select({
          id: schema.lamiraLugares.id,
          url: schema.lamiraLugares.imageUrl,
          credit: schema.lamiraLugares.imageCredit,
          title: schema.lamiraLugares.name,
          categoryName: schema.categories.name,
        })
        .from(schema.lamiraLugares)
        .leftJoin(schema.categories, eq(schema.lamiraLugares.categoryId, schema.categories.id))
        .where(isNotNull(schema.lamiraLugares.imageUrl)),
      this.db
        .select({ id: schema.reportajes.id, url: schema.reportajes.imageUrl, credit: schema.reportajes.imageCredit, title: schema.reportajes.title, categoryName: schema.categories.name })
        .from(schema.reportajes)
        .leftJoin(schema.categories, eq(schema.reportajes.categoryId, schema.categories.id))
        .where(isNotNull(schema.reportajes.imageUrl)),
      this.db
        .select({ id: schema.events.id, url: schema.events.imageUrl, credit: schema.events.imageCredit, title: schema.events.name, categoryName: schema.categories.name })
        .from(schema.events)
        .leftJoin(schema.categories, eq(schema.events.categoryId, schema.categories.id))
        .where(isNotNull(schema.events.imageUrl)),
      this.db
        .select({ id: schema.planazoGuides.id, url: schema.planazoGuides.imageUrl, credit: schema.planazoGuides.imageCredit, title: schema.planazoGuides.title, categoryName: schema.planazoGuides.categoryLabel })
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
      // `places` tiene categorías N:M (place_categories) — se resuelve aparte
      // en JS (primera categoría por lugar) en vez de un join directo, que
      // multiplicaría cada foto por cada categoría del lugar.
      this.db
        .select({ placeId: schema.placeCategories.placeId, categoryName: schema.categories.name })
        .from(schema.placeCategories)
        .innerJoin(schema.categories, eq(schema.placeCategories.categoryId, schema.categories.id)),
    ]);

    const tag = (
      rows: { id: string; url: string | null; credit: string | null; title: string; categoryName: string | null }[],
      contentType: string,
      site: 'la-mira' | 'planazo',
    ): MediaItem[] =>
      rows
        .filter((r): r is typeof r & { url: string } => !!r.url)
        .map((r) => ({ id: r.id, url: r.url, credit: r.credit, alt: null, contentType, contentId: r.id, contentTitle: r.title, site, categoryName: r.categoryName }));

    const placeCategoryByPlaceId = new Map<string, string>();
    for (const row of placeCategoryRows) {
      if (!placeCategoryByPlaceId.has(row.placeId)) placeCategoryByPlaceId.set(row.placeId, row.categoryName);
    }

    const placePhotos: MediaItem[] = photos.map((p) => ({
      id: p.id,
      url: p.url,
      credit: p.credit,
      alt: p.alt,
      contentType: 'place',
      contentId: p.placeId,
      contentTitle: p.placeName,
      site: 'planazo',
      categoryName: placeCategoryByPlaceId.get(p.placeId) ?? null,
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

  // Acervo aparte de imágenes encontradas por el buscador (Wikimedia/
  // Openverse) que todavía no están usadas en ninguna pieza — "más
  // variedad" para cuando haga falta reemplazar algo. El binario se sube al
  // FTP del cliente (ver FtpStorageService); aquí solo se guarda la URL
  // pública final.
  async listAssets(): Promise<MediaAsset[]> {
    const rows = await this.db
      .select({
        id: schema.mediaAssets.id,
        url: schema.mediaAssets.url,
        credit: schema.mediaAssets.credit,
        source: schema.mediaAssets.source,
        sourcePageUrl: schema.mediaAssets.sourcePageUrl,
        categoryName: schema.categories.name,
        createdAt: schema.mediaAssets.createdAt,
      })
      .from(schema.mediaAssets)
      .leftJoin(schema.categories, eq(schema.mediaAssets.categoryId, schema.categories.id))
      .orderBy(desc(schema.mediaAssets.createdAt));

    return rows.map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }));
  }

  async saveAsset(dto: SaveMediaAssetDto): Promise<MediaAsset> {
    const publicUrl = await this.ftpStorage.uploadFromUrl(dto.url, dto.credit ?? 'imagen');

    const [inserted] = await this.db
      .insert(schema.mediaAssets)
      .values({
        url: publicUrl,
        credit: dto.credit ?? null,
        source: dto.source,
        sourcePageUrl: dto.sourcePageUrl ?? null,
        categoryId: dto.categoryId ?? null,
      })
      .returning({ id: schema.mediaAssets.id, createdAt: schema.mediaAssets.createdAt });

    const categoryName = dto.categoryId
      ? ((await this.db.query.categories.findFirst({ where: eq(schema.categories.id, dto.categoryId) }))?.name ?? null)
      : null;

    return {
      id: inserted.id,
      url: publicUrl,
      credit: dto.credit ?? null,
      source: dto.source,
      sourcePageUrl: dto.sourcePageUrl ?? null,
      categoryName,
      createdAt: inserted.createdAt.toISOString(),
    };
  }

  // Solo borra el registro — el archivo huérfano se queda en el FTP (no hace
  // daño, y borrar por FTP en cada delete complica el flujo sin mucho
  // beneficio real para este acervo).
  async deleteAsset(id: string): Promise<void> {
    const existing = await this.db.query.mediaAssets.findFirst({ where: eq(schema.mediaAssets.id, id) });
    if (!existing) throw new NotFoundException(`Imagen "${id}" no existe`);
    await this.db.delete(schema.mediaAssets).where(eq(schema.mediaAssets.id, id));
  }
}
