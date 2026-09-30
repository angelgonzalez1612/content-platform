import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { inArray, eq } from 'drizzle-orm';
import { z } from 'zod';
import type { ContentBlock, GuideSection, Seo } from '@planazo/types';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { noticias, reportajes, guias, places, events, planazoGuides } from '../../db/schema';
import { ProviderRegistry } from '../ai/provider-registry.service';
import { NoticiasService } from '../lamira-noticias/noticias.service';
import { ReportajesService } from '../lamira-reportajes/reportajes.service';
import { GuiasService } from '../lamira-guias/guias.service';
import { PlacesService } from '../places/places.service';
import { EventsService } from '../events/events.service';
import { PlanazoGuidesService } from '../planazo-guides/guides.service';
import { SiteRevalidationService } from '../site-revalidation/site-revalidation.service';
import { evaluatePiece, type ReviewEvaluation, type ReviewPiece, type ReviewableType } from './evaluate-piece';

const PENDING = ['in_review', 'draft'] as const;

const EDIT_HREF: Record<ReviewableType, (id: string) => string> = {
  noticia: (id) => `/contenido/lamira/noticia/${id}`,
  reportaje: (id) => `/contenido/lamira/reportaje/${id}`,
  guia: (id) => `/contenido/lamira/guia/${id}`,
  place: (id) => `/contenido/${id}`,
  'evento-planazo': (id) => `/contenido/planazo-evento/${id}`,
  'planazo-guia': (id) => `/contenido/planazo-guia/${id}`,
};

export interface ReviewQueueItem extends ReviewEvaluation {
  type: ReviewableType;
  site: ReviewPiece['site'];
  id: string;
  title: string;
  status: string;
  imageUrl: string | null;
  categoryName: string | null;
  createdAt: string | null;
  editHref: string;
}

export interface AiReview {
  veredicto: 'publicar' | 'corregir' | 'descartar';
  encaja: 'la-mira' | 'planazo' | 'ninguno';
  resumen: string;
  problemas: string[];
}

const blockText = (blocks: ContentBlock[] | null | undefined) => ({
  paragraphs: (blocks ?? []).flatMap((b) => b.paragraphs ?? []),
  headings: (blocks ?? []).map((b) => b.heading ?? '').filter(Boolean),
});

const iso = (d: Date | null | undefined) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.toISOString() : null);

/**
 * "Revisor": revisa la cola de borradores/en revisión de La Mira y Planazo
 * contra criterios medibles (evaluatePiece) y, a pedido, con IA. No publica
 * solo: publicar es siempre un clic del editor (ver publish()).
 */
@Injectable()
export class ReviewAgentService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly providers: ProviderRegistry,
    private readonly noticiasService: NoticiasService,
    private readonly reportajesService: ReportajesService,
    private readonly guiasService: GuiasService,
    private readonly placesService: PlacesService,
    private readonly eventsService: EventsService,
    private readonly planazoGuidesService: PlanazoGuidesService,
    private readonly revalidation: SiteRevalidationService,
  ) {}

  async queue(): Promise<ReviewQueueItem[]> {
    const pieces = await this.loadPieces();
    return pieces
      .map(({ piece, createdAt }) => ({
        ...evaluatePiece(piece),
        type: piece.type,
        site: piece.site,
        id: piece.id,
        title: piece.title,
        status: piece.status,
        imageUrl: piece.imageUrl,
        categoryName: piece.categoryName,
        createdAt,
        editHref: EDIT_HREF[piece.type](piece.id),
      }))
      .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }

  /** Segunda opinión con IA: ¿encaja en el sitio, es coherente, inventa, sirve al lector? */
  async analyze(type: ReviewableType, id: string): Promise<AiReview & { checks: ReviewEvaluation['checks'] }> {
    const found = (await this.loadPieces({ type, id }))[0];
    if (!found) throw new NotFoundException('La pieza no existe o ya no está pendiente.');
    const { piece } = found;
    const evaluation = evaluatePiece(piece);

    const schema = z.object({
      veredicto: z.enum(['publicar', 'corregir', 'descartar']).describe('publicar = lista; corregir = sirve pero hay que arreglar algo; descartar = no vale la pena publicarla.'),
      encaja: z.enum(['la-mira', 'planazo', 'ninguno']).describe('En qué sitio encaja mejor la pieza.'),
      resumen: z.string().describe('Una o dos oraciones en español para el editor explicando el veredicto.'),
      problemas: z.array(z.string()).max(6).describe('Problemas concretos y accionables (vacío si no hay).'),
    });

    const failed = evaluation.checks.filter((c) => !c.passed).map((c) => `- ${c.label}${c.detail ? `: ${c.detail}` : ''}`);
    const output = (await this.providers.generateWithFallback('default', {
      systemPrompt: `Eres el editor en jefe de dos sitios de la Ciudad de México que comparten CMS:
- La Mira: periódico digital hiperlocal de CDMX y zona metropolitana (noticias del día, reportajes, guías de servicio).
- Planazo: directorio de planes, lugares y eventos recomendables para visitar en CDMX. No publica noticias.
Revisas un borrador antes de publicarlo. Juzga: si el tema le importa a su público (una nota de fútbol brasileño o de otro país sin relación con México no encaja), si el texto informa o solo rellena ("la información disponible no precisa…"), si hay afirmaciones que parezcan inventadas o especulativas, si el título corresponde al cuerpo, y si está en español de México. No corrijas usos correctos en México (se escribe "futbol", sin tilde) ni el estilo: enfócate en lo que impide publicar. Sé directo y breve.`,
      userPrompt: `Tipo: ${piece.type} (${piece.site})
Título: ${piece.title}
Bajada/descripción: ${piece.summary.slice(0, 3000)}
Categoría: ${piece.categoryName ?? '(sin categoría)'}
Fuente: ${piece.sourceUrl ?? piece.externalSource ?? '(ninguna)'}
Imagen: ${piece.imageUrl ? 'sí' : 'no'} · ${evaluation.words} palabras

Cuerpo:
${piece.paragraphs.length ? piece.paragraphs.join('\n\n').slice(0, 6000) : '(sin secciones: en este tipo el texto principal es la descripción de arriba)'}

Revisión automática — lo que ya falló:
${failed.length ? failed.join('\n') : '(nada)'}`,
      schema,
      schemaName: 'review_agent',
    })) as AiReview;

    return { ...output, checks: evaluation.checks };
  }

  /**
   * Publica las piezas elegidas por el editor. Por seguridad se vuelven a
   * revisar aquí: las que tienen un criterio bloqueante sin cumplir no se
   * publican (se regresan en `skipped`). Noticias y reportajes toman la
   * fecha de hoy, para salir arriba en la portada.
   */
  async publish(items: { type: ReviewableType; id: string }[]) {
    const published: { type: ReviewableType; id: string }[] = [];
    const skipped: { type: ReviewableType; id: string; reason: string }[] = [];
    const sites = new Set<ReviewPiece['site']>();

    for (const item of items) {
      const found = (await this.loadPieces(item))[0];
      if (!found) {
        skipped.push({ ...item, reason: 'Ya no está pendiente.' });
        continue;
      }
      const evaluation = evaluatePiece(found.piece);
      const blocking = evaluation.checks.filter((c) => c.blocking && !c.passed);
      if (blocking.length) {
        skipped.push({ ...item, reason: blocking.map((c) => c.label).join(', ') });
        continue;
      }
      const now = new Date();
      switch (item.type) {
        case 'noticia':
          await this.noticiasService.update(item.id, { status: 'published', publishedAt: now });
          break;
        case 'reportaje':
          await this.reportajesService.update(item.id, { status: 'published', publishedAt: now });
          break;
        case 'guia':
          await this.guiasService.update(item.id, { status: 'published' });
          break;
        case 'place':
          await this.placesService.update(item.id, { status: 'published' });
          break;
        case 'evento-planazo':
          await this.eventsService.update(item.id, { status: 'published' });
          break;
        case 'planazo-guia':
          await this.planazoGuidesService.update(item.id, { status: 'published' });
          break;
      }
      published.push(item);
      sites.add(found.piece.site);
    }

    sites.forEach((site) => this.revalidation.trigger(site));
    return { published, skipped };
  }

  /** Piezas pendientes de los 6 tipos (o solo una, con `only`), ya normalizadas. */
  private async loadPieces(only?: { type: ReviewableType; id: string }): Promise<{ piece: ReviewPiece; createdAt: string | null }[]> {
    const want = (t: ReviewableType) => !only || only.type === t;
    const out: { piece: ReviewPiece; createdAt: string | null }[] = [];

    if (want('noticia')) {
      const rows = await this.db.query.noticias.findMany({
        where: only ? eq(noticias.id, only.id) : inArray(noticias.status, [...PENDING]),
        with: { category: true },
      });
      for (const r of rows) {
        if (!PENDING.includes(r.status as (typeof PENDING)[number])) continue;
        out.push({
          createdAt: iso(r.createdAt),
          piece: {
            type: 'noticia', site: 'la-mira', id: r.id, title: r.title, summary: r.dek, ...blockText(r.content),
            imageUrl: r.imageUrl ?? null, categoryName: r.category?.name ?? null, sourceUrl: r.sourceUrl ?? null,
            externalSource: r.externalSource ?? null, seo: (r.seo as Seo | null) ?? null, status: r.status, updatedAt: iso(r.updatedAt),
          },
        });
      }
    }

    if (want('reportaje')) {
      const rows = await this.db.query.reportajes.findMany({
        where: only ? eq(reportajes.id, only.id) : inArray(reportajes.status, [...PENDING]),
        with: { category: true },
      });
      for (const r of rows) {
        if (!PENDING.includes(r.status as (typeof PENDING)[number])) continue;
        out.push({
          createdAt: iso(r.createdAt),
          piece: {
            type: 'reportaje', site: 'la-mira', id: r.id, title: r.title, summary: r.dek, ...blockText(r.content),
            imageUrl: r.imageUrl ?? null, categoryName: r.category?.name ?? null, sourceUrl: r.sourceUrl ?? null,
            externalSource: null, seo: (r.seo as Seo | null) ?? null, status: r.status, updatedAt: null,
          },
        });
      }
    }

    if (want('guia')) {
      const rows = await this.db.query.guias.findMany({
        where: only ? eq(guias.id, only.id) : inArray(guias.status, [...PENDING]),
        with: { category: true },
      });
      for (const r of rows) {
        if (!PENDING.includes(r.status as (typeof PENDING)[number])) continue;
        out.push({
          createdAt: iso(r.createdAt),
          piece: {
            type: 'guia', site: 'la-mira', id: r.id, title: r.title, summary: r.dek, ...blockText(r.content as ContentBlock[]),
            imageUrl: r.imageUrl ?? null, categoryName: r.category?.name ?? null, sourceUrl: r.officialSource?.url ?? null,
            externalSource: r.officialSource?.label ?? null, seo: (r.seo as Seo | null) ?? null, status: r.status, updatedAt: iso(r.updatedAt),
          },
        });
      }
    }

    if (want('place')) {
      const rows = await this.db.query.places.findMany({
        where: only ? eq(places.id, only.id) : inArray(places.status, [...PENDING]),
        with: { photos: true, placeCategories: { with: { category: true } } },
      });
      for (const r of rows) {
        if (!PENDING.includes(r.status as (typeof PENDING)[number])) continue;
        const cover = [...r.photos].sort((a, b) => a.position - b.position)[0];
        out.push({
          createdAt: iso(r.createdAt),
          piece: {
            type: 'place', site: 'planazo', id: r.id, title: r.name, summary: r.description ?? '', ...blockText(r.content as ContentBlock[]),
            imageUrl: cover?.url ?? null, categoryName: r.placeCategories[0]?.category?.name ?? null, sourceUrl: r.sourceUrl ?? null,
            externalSource: null, seo: (r.seo as Seo | null) ?? null, status: r.status, updatedAt: iso(r.updatedAt),
          },
        });
      }
    }

    if (want('evento-planazo')) {
      const rows = await this.db.query.events.findMany({
        where: only ? eq(events.id, only.id) : inArray(events.status, [...PENDING]),
        with: { category: true },
      });
      for (const r of rows) {
        if (!PENDING.includes(r.status as (typeof PENDING)[number])) continue;
        out.push({
          createdAt: iso(r.createdAt),
          piece: {
            type: 'evento-planazo', site: 'planazo', id: r.id, title: r.name, summary: r.description ?? '', ...blockText(r.content),
            imageUrl: r.imageUrl ?? null, categoryName: r.category?.name ?? null, sourceUrl: r.sourceUrl ?? null,
            externalSource: null, seo: (r.seo as Seo | null) ?? null, status: r.status, updatedAt: null,
          },
        });
      }
    }

    if (want('planazo-guia')) {
      const rows = await this.db.query.planazoGuides.findMany({
        where: only ? eq(planazoGuides.id, only.id) : inArray(planazoGuides.status, [...PENDING]),
      });
      for (const r of rows) {
        if (!PENDING.includes(r.status as (typeof PENDING)[number])) continue;
        const sections = (r.sections ?? []) as GuideSection[];
        out.push({
          createdAt: iso(r.createdAt),
          piece: {
            type: 'planazo-guia', site: 'planazo', id: r.id, title: r.title, summary: r.description,
            paragraphs: [r.intro ?? '', ...sections.map((s) => s.body)].filter(Boolean),
            headings: sections.map((s) => s.heading).filter(Boolean),
            imageUrl: r.imageUrl ?? null, categoryName: r.categoryLabel || null, sourceUrl: null,
            externalSource: null, seo: (r.seo as Seo | null) ?? null, status: r.status, updatedAt: iso(r.updatedAt),
          },
        });
      }
    }

    return out;
  }
}
