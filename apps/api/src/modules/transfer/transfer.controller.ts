import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { z } from 'zod';
import { JwtAuthGuard, type RequestWithSession } from '../auth/jwt-auth.guard';
import { assertAdmin } from '../auth/assert-admin';
import { PlacesService } from '../places/places.service';
import { EventsService } from '../events/events.service';
import { NoticiasService } from '../lamira-noticias/noticias.service';
import { ReportajesService } from '../lamira-reportajes/reportajes.service';
import { AlertasService } from '../lamira-alertas/alertas.service';
import { createNoticiaSchema } from '../lamira-noticias/dto/noticia.dto';
import { createReportajeSchema } from '../lamira-reportajes/dto/reportaje.dto';
import { createAlertaSchema } from '../lamira-alertas/dto/alerta.dto';
import { SiteRevalidationService } from '../site-revalidation/site-revalidation.service';
import { buildLamiraPayload, type TransferSource } from './build-lamira-payload';

const moveToLamiraSchema = z.object({
  sourceType: z.enum(['place', 'evento-planazo']),
  sourceId: z.string().min(1),
  targetType: z.enum(['noticia', 'reportaje', 'alerta']),
  categoryId: z.string().nullable().optional(),
  // Qué pasa con la pieza de Planazo: eliminarla (sin duplicado), dejarla como
  // borrador, o conservarla publicada en los dos sitios.
  original: z.enum(['delete', 'unpublish', 'keep']),
});

/**
 * "Mover a La Mira": una pieza de Planazo que en realidad es noticia (p.ej. un
 * video de un pleito en el Metro clasificado como lugar) se convierte en una
 * noticia/reportaje/alerta de La Mira sin volver a generarla — mismo título,
 * texto, secciones, foto (con encuadre), video, fuente y SEO.
 */
@UseGuards(JwtAuthGuard)
@Controller('cms/transfer')
export class TransferController {
  constructor(
    private readonly places: PlacesService,
    private readonly events: EventsService,
    private readonly noticias: NoticiasService,
    private readonly reportajes: ReportajesService,
    private readonly alertas: AlertasService,
    private readonly revalidation: SiteRevalidationService,
  ) {}

  @Post('planazo-to-lamira')
  async moveToLamira(@Req() req: RequestWithSession, @Body() body: unknown) {
    const dto = moveToLamiraSchema.parse(body);
    if (dto.original === 'delete') assertAdmin(req); // eliminar es solo para admin

    const source = await this.loadSource(dto.sourceType, dto.sourceId);
    const payload = buildLamiraPayload(source, dto.targetType, dto.categoryId ?? null);

    const created =
      dto.targetType === 'noticia'
        ? await this.noticias.create(createNoticiaSchema.parse(payload))
        : dto.targetType === 'reportaje'
          ? await this.reportajes.create(createReportajeSchema.parse(payload))
          : await this.alertas.create(createAlertaSchema.parse(payload));

    if (dto.original === 'delete') {
      if (dto.sourceType === 'place') await this.places.remove(dto.sourceId);
      else await this.events.remove(dto.sourceId);
    } else if (dto.original === 'unpublish') {
      if (dto.sourceType === 'place') await this.places.update(dto.sourceId, { status: 'draft' });
      else await this.events.update(dto.sourceId, { status: 'draft' });
    }

    this.revalidation.trigger('la-mira');
    this.revalidation.trigger('planazo');
    return { targetType: dto.targetType, id: created.id, editPath: `/contenido/lamira/${dto.targetType}/${created.id}` };
  }

  private async loadSource(type: 'place' | 'evento-planazo', id: string): Promise<TransferSource> {
    if (type === 'place') {
      const place = await this.places.findByIdForCms(id);
      const cover = [...place.photos].sort((a, b) => a.position - b.position)[0];
      return {
        title: place.name,
        description: place.description ?? '',
        content: place.content ?? [],
        imageUrl: cover?.url ?? null,
        imageCredit: cover?.credit ?? null,
        imagePosition: place.imagePosition ?? null,
        youtubeId: place.youtubeId ?? null,
        sourceUrl: place.sourceUrl ?? null,
        seo: place.seo ?? null,
      };
    }
    const event = await this.events.findByIdForCms(id);
    return {
      title: event.name,
      description: event.description ?? '',
      content: event.content ?? [],
      imageUrl: event.imageUrl,
      imageCredit: event.imageCredit,
      imagePosition: event.imagePosition ?? null,
      youtubeId: event.youtubeId ?? null,
      sourceUrl: event.sourceUrl ?? null,
      seo: event.seo ?? null,
    };
  }
}
