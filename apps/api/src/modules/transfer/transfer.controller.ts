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
import { ProviderRegistry } from '../ai/provider-registry.service';
import { CategoriesService } from '../categories/categories.service';
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

const suggestSchema = z.object({
  sourceType: z.enum(['place', 'evento-planazo']),
  sourceId: z.string().min(1),
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
    private readonly providers: ProviderRegistry,
    private readonly categories: CategoriesService,
  ) {}

  /**
   * "Que la IA decida" en el modal: ¿esta pieza encaja más en La Mira
   * (periódico hiperlocal) o en Planazo (directorio de planes)? y, si es La
   * Mira, como qué tipo y en qué categoría. Solo sugiere; el editor confirma.
   */
  @Post('suggest')
  async suggest(@Body() body: unknown) {
    const dto = suggestSchema.parse(body);
    const source = await this.loadSource(dto.sourceType, dto.sourceId);
    const lamiraCategories = await this.categories.findAll('la-mira');
    const slugs = lamiraCategories.map((c) => c.slug) as [string, ...string[]];

    const schema = z.object({
      belongsIn: z.enum(['la-mira', 'planazo']).describe('Dónde encaja mejor esta pieza.'),
      targetType: z.enum(['noticia', 'reportaje', 'alerta']).describe('Si va en La Mira, como qué tipo.'),
      categorySlug: z.enum(slugs).describe('Categoría de La Mira que mejor le queda.'),
      reason: z.string().describe('Una oración en español explicando la decisión, para el editor.'),
    });

    const output = await this.providers.generateWithFallback('default', {
      systemPrompt: `Eres editor de dos sitios de la Ciudad de México que comparten CMS:
- La Mira: periódico digital hiperlocal. Noticias (hechos del día), reportajes (piezas de fondo) y alertas (avisos activos: tráfico, marchas, clima, cortes).
- Planazo: directorio evergreen de planes y lugares recomendados (restaurantes, bares, museos, eventos a los que ir). NO publica noticias ni cobertura.
Decide dónde encaja mejor una pieza. Una nota sobre algo que pasó, una iniciativa, un incidente o un video noticioso va en La Mira. Solo un lugar o plan recomendable para visitar encaja en Planazo. Responde en español de México.`,
      userPrompt: `Título: ${source.title}
Descripción: ${source.description.slice(0, 1200)}
${source.content.length ? `Secciones: ${source.content.map((b) => b.heading).filter(Boolean).join(' · ')}` : ''}
${source.sourceUrl ? `Fuente: ${source.sourceUrl}` : ''}

Categorías de La Mira disponibles:
${lamiraCategories.map((c) => `- ${c.slug}: ${c.name}`).join('\n')}`,
      schema,
      schemaName: 'site_suggestion',
    });

    const category = lamiraCategories.find((c) => c.slug === output.categorySlug) ?? null;
    return {
      belongsIn: output.belongsIn,
      targetType: output.targetType,
      categoryId: category?.id ?? null,
      categoryName: category?.name ?? null,
      reason: output.reason,
    };
  }

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
