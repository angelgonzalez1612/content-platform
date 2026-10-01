import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { slugify } from '@planazo/shared';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import type { ContentBlock, GuideSection, Seo } from '@planazo/types';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { noticias, reportajes, guias, places, events, planazoGuides, contentAuditLog, sites } from '../../db/schema';
import { ProviderRegistry, type AiProviderChoice } from '../ai/provider-registry.service';
import { SeoGenerateService } from '../ai/seo-generate.service';
import { ArticleScraperService } from '../ai/article-scraper.service';
import { ImageSearchService } from '../ai/image-search.service';
import { AiDraftService } from '../ai/ai-draft.service';
import { NoticiasService } from '../lamira-noticias/noticias.service';
import { ReportajesService } from '../lamira-reportajes/reportajes.service';
import { GuiasService } from '../lamira-guias/guias.service';
import { PlacesService } from '../places/places.service';
import { EventsService } from '../events/events.service';
import { PlanazoGuidesService } from '../planazo-guides/guides.service';
import { SiteRevalidationService } from '../site-revalidation/site-revalidation.service';
import { contentHash, evaluatePiece, type ReviewEvaluation, type ReviewPiece, type ReviewableType } from './evaluate-piece';

const PENDING = ['in_review', 'draft'] as const;

const EDIT_HREF: Record<ReviewableType, (id: string) => string> = {
  noticia: (id) => `/contenido/lamira/noticia/${id}`,
  reportaje: (id) => `/contenido/lamira/reportaje/${id}`,
  guia: (id) => `/contenido/lamira/guia/${id}`,
  place: (id) => `/contenido/${id}`,
  'evento-planazo': (id) => `/contenido/planazo-evento/${id}`,
  'planazo-guia': (id) => `/contenido/planazo-guia/${id}`,
};

/** Criterios que el Revisor sabe arreglar solo, con la etiqueta de su botón. */
export type FixableCheck = 'seo' | 'imagen' | 'longitud' | 'estructura' | 'titulo' | 'bajada';

const FIX_LABEL: Record<FixableCheck, string> = {
  seo: 'Generar SEO',
  imagen: 'Buscar imagen',
  longitud: 'Alargar con IA',
  estructura: 'Agregar secciones con IA',
  titulo: 'Reescribir título',
  bajada: 'Escribir bajada',
};

function fixFor(checkId: string, type: ReviewableType): string | undefined {
  if (!(checkId in FIX_LABEL)) return undefined;
  // "Agregar contenido" con IA no existe para las guías de Planazo (secciones = lugares reales).
  if ((checkId === 'longitud' || checkId === 'estructura') && type === 'planazo-guia') return undefined;
  return FIX_LABEL[checkId as FixableCheck];
}

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
  slug: string;
  /** Última revisión con IA guardada; `stale` = la pieza cambió después. */
  ai: { review: AiReview; reviewedAt: string; stale: boolean } | null;
  /** Último arreglo/corrección hecho desde el Revisor (para el indicador "Corregida"). */
  lastFix: { at: string; message: string } | null;
}

// Arreglos y correcciones hechos desde el Revisor, y piezas archivadas: también
// en content_audit_log, para el indicador "Corregida" y para auditar.
const FIX_MODE = 'review-fix';
const DISCARD_MODE = 'review-discard';

// Las revisiones con IA se guardan en content_audit_log con este modo (no
// necesita tabla propia): así sobreviven a recargar la página y las ve todo el equipo.
const REVIEW_MODE = 'review';

export interface AiReview {
  veredicto: 'publicar' | 'corregir' | 'descartar';
  encaja: 'la-mira' | 'planazo' | 'ninguno';
  resumen: string;
  problemas: string[];
}

const blockText = (blocks: ContentBlock[] | null | undefined) => ({
  paragraphs: (blocks ?? []).flatMap((b) => b.paragraphs ?? []),
  headings: (blocks ?? []).map((b) => b.heading ?? '').filter(Boolean),
  blocks: blocks ?? [],
});

/** Propuesta de "Aplicar correcciones": lo actual y lo corregido, campo por campo. */
export interface CorrectionProposal {
  problems: string[];
  current: { title: string; summary: string; content: { heading: string | null; paragraphs: string[] }[] };
  proposed: { title: string; summary: string; content: { heading: string | null; paragraphs: string[] }[] };
  /** Guías de Planazo: el cuerpo son lugares reales, solo se corrigen título y descripción. */
  bodyEditable: boolean;
  note: string;
}

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
    private readonly seoService: SeoGenerateService,
    private readonly scraper: ArticleScraperService,
    private readonly imageSearch: ImageSearchService,
    private readonly aiDraft: AiDraftService,
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
    const ids = pieces.map(({ piece }) => piece.id);
    const [saved, fixes] = await Promise.all([this.savedReviews(ids), this.savedFixes(ids)]);
    return pieces.map(({ piece, createdAt }) => this.toItem(piece, createdAt, saved, fixes)).sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
  }

  private toItem(
    piece: ReviewPiece,
    createdAt: string | null,
    saved: Map<string, { review: AiReview; reviewedAt: string; hash: string | null }>,
    fixes: Map<string, { at: string; message: string }> = new Map(),
  ): ReviewQueueItem {
    const evaluation = evaluatePiece(piece);
    return {
        slug: piece.slug,
        lastFix: fixes.get(`${piece.type}:${piece.id}`) ?? null,
        ...evaluation,
        checks: evaluation.checks.map((c) => (c.passed ? c : { ...c, fix: fixFor(c.id, piece.type) })),
        type: piece.type,
        site: piece.site,
        id: piece.id,
        title: piece.title,
        status: piece.status,
        imageUrl: piece.imageUrl,
        categoryName: piece.categoryName,
        createdAt,
        editHref: EDIT_HREF[piece.type](piece.id),
        ai: (() => {
          const row = saved.get(`${piece.type}:${piece.id}`);
          return row ? { review: row.review, reviewedAt: row.reviewedAt, stale: row.hash !== contentHash(piece) } : null;
        })(),
    };
  }

  /**
   * "Arreglar" un criterio que falló: genera lo que falta y lo guarda en la
   * pieza (que sigue en revisión; el cambio queda en el historial de
   * versiones). Devuelve la pieza ya reevaluada y qué se hizo.
   */
  async fix(type: ReviewableType, id: string, check: FixableCheck, actorId?: string, choice: AiProviderChoice = 'default'): Promise<{ item: ReviewQueueItem; message: string }> {
    const found = (await this.loadPieces({ type, id }))[0];
    if (!found) throw new NotFoundException('La pieza no existe o ya no está pendiente.');
    if (!fixFor(check, type)) throw new BadRequestException('Este criterio no se puede arreglar solo en este tipo de pieza.');
    const { piece } = found;
    const provider = await this.providers.resolveProvider(choice);
    let message: string;

    switch (check) {
      case 'seo': {
        const seo = await this.seoService.generateSeo({
          provider,
          contentTitle: piece.title,
          contentContext: [piece.summary, ...piece.paragraphs].join('\n').slice(0, 3000),
        });
        await this.save(piece, { seo: { ...(piece.seo ?? {}), title: seo.title, description: seo.description } });
        message = `SEO generado: «${seo.title}».`;
        break;
      }
      case 'imagen': {
        const image = await this.findImage(piece);
        if (!image) throw new BadRequestException('No encontré una imagen real para esta pieza. Búscala a mano en la pieza.');
        await this.save(piece, { image });
        message = `Imagen agregada (${image.credit}).`;
        break;
      }
      case 'longitud':
      case 'estructura': {
        const result = await this.aiDraft.improveContent(type, id, { mode: 'expand', provider }, actorId);
        const content = (result.draft as { content?: ContentBlock[] }).content ?? [];
        const added = content.filter((b) => b.heading?.trim()).length - piece.headings.length;
        await this.save(piece, { content });
        message = `Se ${added === 1 ? 'agregó 1 sección nueva' : `agregaron ${Math.max(added, 1)} secciones nuevas`} con IA. Revísalas en la pieza.`;
        break;
      }
      case 'titulo':
      case 'bajada': {
        const field = check === 'titulo' ? 'título' : 'bajada';
        const output = (await this.providers.generateWithFallback(provider, {
          systemPrompt:
            'Eres editor de un medio digital de la Ciudad de México. Reescribes un título o una bajada para publicarla: en español de México, claro y atractivo, sin hashtags ni emojis, sin clickbait, y sin agregar datos que no estén en el texto (nombres, cifras, fechas).',
          userPrompt: `Escribe ${check === 'titulo' ? 'un TÍTULO de 40 a 90 caracteres' : 'una BAJADA de 120 a 220 caracteres que resuma la pieza'}.
Título actual: ${piece.title}
Bajada actual: ${piece.summary || '(vacía)'}
Texto:
${piece.paragraphs.join('\n').slice(0, 4000) || piece.summary}`,
          schema: z.object({ text: z.string().describe(`El ${field} nuevo, sin comillas.`) }),
          schemaName: `review_fix_${check}`,
        }, { fallback: choice === 'default' })) as { text: string };
        const text = output.text.trim().replace(/^["«]|["»]$/g, '');
        await this.save(piece, check === 'titulo' ? { title: text } : { summary: text });
        message = `${check === 'titulo' ? 'Título' : 'Bajada'} nuevo: «${text}».`;
        break;
      }
    }

    await this.logAction(piece, FIX_MODE, { message }, actorId);
    const refreshed = (await this.loadPieces({ type, id }))[0];
    if (!refreshed) throw new NotFoundException('La pieza ya no está pendiente.');
    const [saved, fixes] = await Promise.all([this.savedReviews([id]), this.savedFixes([id])]);
    return { item: this.toItem(refreshed.piece, refreshed.createdAt, saved, fixes), message };
  }

  /**
   * "Archivar" desde el Revisor (p.ej. la IA dice "descartar"): sale de la
   * cola y no se publica, pero no se borra — queda como archivada en
   * Contenido y en el historial de versiones, por si se quiere recuperar.
   */
  async discard(type: ReviewableType, id: string, actorId?: string): Promise<{ ok: true }> {
    const found = (await this.loadPieces({ type, id }))[0];
    if (!found) throw new NotFoundException('La pieza no existe o ya no está pendiente.');
    const archived = { status: 'archived' as const };
    switch (type) {
      case 'noticia':
        await this.noticiasService.update(id, archived);
        break;
      case 'reportaje':
        await this.reportajesService.update(id, archived);
        break;
      case 'guia':
        await this.guiasService.update(id, archived);
        break;
      case 'place':
        await this.placesService.update(id, archived);
        break;
      case 'evento-planazo':
        await this.eventsService.update(id, archived);
        break;
      case 'planazo-guia':
        await this.planazoGuidesService.update(id, archived);
        break;
    }
    await this.logAction(found.piece, DISCARD_MODE, { message: 'Archivada desde el Revisor' }, actorId, 'archived');
    return { ok: true };
  }

  /** Último arreglo/corrección de cada pieza (clave `tipo:id`). */
  private async savedFixes(ids: string[]): Promise<Map<string, { at: string; message: string }>> {
    const out = new Map<string, { at: string; message: string }>();
    if (!ids.length) return out;
    const rows = await this.db
      .select({ contentType: contentAuditLog.contentType, contentId: contentAuditLog.contentId, aiOutput: contentAuditLog.aiOutput, createdAt: contentAuditLog.createdAt })
      .from(contentAuditLog)
      .where(and(eq(contentAuditLog.mode, FIX_MODE), inArray(contentAuditLog.contentId, ids)))
      .orderBy(desc(contentAuditLog.createdAt));
    for (const r of rows) {
      const key = `${r.contentType}:${r.contentId}`;
      if (!out.has(key)) out.set(key, { at: r.createdAt.toISOString(), message: String((r.aiOutput as { message?: string }).message ?? '') });
    }
    return out;
  }

  private async logAction(piece: ReviewPiece, mode: string, output: Record<string, unknown>, actorId?: string, statusAfter?: string): Promise<void> {
    const site = await this.db.query.sites.findFirst({ where: eq(sites.slug, piece.site) });
    if (!site) return;
    await this.db.insert(contentAuditLog).values({
      siteId: site.id,
      contentType: piece.type,
      contentId: piece.id,
      mode,
      aiModel: 'revisor',
      aiOutput: output,
      checksRun: [],
      decision: mode === DISCARD_MODE ? 'discarded' : 'needs-review',
      statusBefore: piece.status as never,
      statusAfter: (statusAfter ?? piece.status) as never,
      actorId: actorId ?? null,
    });
  }

  /**
   * "Aplicar correcciones": la IA reescribe la pieza siguiendo los problemas
   * de su última revisión. Solo PROPONE — no guarda nada; el editor elige qué
   * aceptar y lo guarda con applyCorrections().
   */
  async proposeCorrections(type: ReviewableType, id: string, choice: AiProviderChoice = 'default'): Promise<CorrectionProposal> {
    const found = (await this.loadPieces({ type, id }))[0];
    if (!found) throw new NotFoundException('La pieza no existe o ya no está pendiente.');
    const { piece } = found;
    const review = (await this.savedReviews([id])).get(`${type}:${id}`)?.review;
    if (!review) throw new BadRequestException('Primero revisa la pieza con IA: las correcciones salen de esa revisión.');
    const failedChecks = evaluatePiece(piece).checks.filter((c) => !c.passed && !c.blocking).map((c) => `${c.label}${c.detail ? `: ${c.detail}` : ''}`);
    const problems = [...review.problemas, ...(review.problemas.length ? [] : [review.resumen])];

    const bodyEditable = type !== 'planazo-guia';
    const current = {
      title: piece.title,
      summary: piece.summary,
      content: bodyEditable ? (piece.blocks ?? []).map((b) => ({ heading: b.heading ?? null, paragraphs: b.paragraphs ?? [] })) : [],
    };
    const schema = z.object({
      title: z.string().describe('Título corregido (o el mismo si no hay que cambiarlo).'),
      summary: z.string().describe('Bajada/descripción corregida (o la misma).'),
      content: z
        .array(z.object({ heading: z.string().nullable(), paragraphs: z.array(z.string()) }))
        .describe('Las MISMAS secciones, en el mismo orden, con sus párrafos corregidos. Puedes quitar párrafos de relleno, no agregues secciones.'),
      note: z.string().describe('Una o dos oraciones para el editor: qué corregiste y qué quedó pendiente de verificar a mano.'),
    });
    const provider = await this.providers.resolveProvider(choice);
    const output = (await this.providers.generateWithFallback(
      provider,
      {
        systemPrompt: `Eres editor de La Mira (periódico hiperlocal de CDMX) y Planazo (planes y lugares en CDMX). Corriges un borrador siguiendo una lista de problemas que encontró la revisión.
Reglas:
- Corrige SOLO lo que dice la lista; deja igual lo que está bien.
- NUNCA agregues datos que no estén ya en el texto (nombres, cifras, fechas, precios, direcciones, horarios, invitados) — tampoco los que mencione la propia lista de problemas, porque nadie los ha verificado. Si un problema pide o sugiere un dato nuevo, quita o suaviza la afirmación dudosa ("según la fuente", "por confirmar") y deja ese dato en la nota como pendiente de verificar.
- Quita relleno y frases genéricas cuando la lista lo pida.
- Español de México ("futbol" sin tilde está bien). Sin hashtags ni emojis.
- Mantén las mismas secciones y su orden${bodyEditable ? '' : ' (en este tipo el cuerpo no se toca: devuelve content vacío)'}.
- Incluye SIEMPRE "note": qué corregiste y qué datos quedan pendientes de verificar a mano.`,
        userPrompt: `Problemas a corregir:
${problems.map((p) => `- ${p}`).join('\n')}
${failedChecks.length ? `\nAdemás, la revisión automática marcó:\n${failedChecks.map((c) => `- ${c}`).join('\n')}\n` : ''}
Título: ${current.title}
Bajada/descripción: ${current.summary}

Cuerpo (JSON):
${JSON.stringify(current.content).slice(0, 12000)}`,
        schema,
        schemaName: 'review_corrections',
      },
      { fallback: choice === 'default' },
    )) as { title: string; summary: string; content: { heading: string | null; paragraphs: string[] }[]; note: string };

    return {
      problems,
      current,
      proposed: {
        title: output.title.trim() || current.title,
        summary: output.summary.trim() || current.summary,
        content: bodyEditable ? output.content : [],
      },
      bodyEditable,
      note: output.note,
    };
  }

  /** Guarda lo que el editor aceptó de "Aplicar correcciones" (queda en el historial de versiones). */
  async applyCorrections(
    type: ReviewableType,
    id: string,
    patch: { title?: string; summary?: string; content?: { heading: string | null; paragraphs: string[] }[] },
    actorId?: string,
  ): Promise<{ item: ReviewQueueItem; message: string }> {
    const found = (await this.loadPieces({ type, id }))[0];
    if (!found) throw new NotFoundException('La pieza no existe o ya no está pendiente.');
    const { piece } = found;

    let content: ContentBlock[] | undefined;
    if (patch.content && type !== 'planazo-guia') {
      // Se conserva lo que la IA no ve de cada sección (imagen, video, publicaciones, id de guía) por posición.
      const original = piece.blocks ?? [];
      content = patch.content.map((b, i) => {
        const base = (original[i] ?? {}) as ContentBlock & { id?: string };
        const merged = { ...base, heading: b.heading, paragraphs: b.paragraphs.filter((p) => p.trim()) } as ContentBlock & { id?: string };
        if (type === 'guia') merged.id = base.id ?? (slugify(b.heading ?? '') || `seccion-${i + 1}`);
        return merged;
      });
    }
    await this.save(piece, {
      ...(patch.title?.trim() && { title: patch.title.trim() }),
      ...(patch.summary?.trim() && { summary: patch.summary.trim() }),
      ...(content && { content }),
    });

    const changed = [patch.title && 'título', patch.summary && 'bajada', content && 'cuerpo'].filter(Boolean).join(', ');
    const message = `Correcciones de la IA aplicadas (${changed || 'nada'}).`;
    await this.logAction(piece, FIX_MODE, { message }, actorId);
    const refreshed = (await this.loadPieces({ type, id }))[0];
    if (!refreshed) throw new NotFoundException('La pieza ya no está pendiente.');
    const [saved, fixes] = await Promise.all([this.savedReviews([id]), this.savedFixes([id])]);
    return { item: this.toItem(refreshed.piece, refreshed.createdAt, saved, fixes), message: `${message} La pieza sigue en revisión.` };
  }

  /** Imagen real para la pieza: la de su nota fuente, o la de una nota sobre el mismo tema. */
  private async findImage(piece: ReviewPiece): Promise<{ url: string; credit: string } | null> {
    if (piece.sourceUrl && !/youtube\.com|youtu\.be/.test(piece.sourceUrl)) {
      const scraped = await this.scraper.scrape(piece.sourceUrl).catch(() => null);
      if (scraped?.imageUrl) return { url: scraped.imageUrl, credit: `Foto: ${scraped.siteName || new URL(piece.sourceUrl).hostname.replace(/^www\./, '')}` };
    }
    const news = await this.imageSearch.searchNews(piece.title).catch(() => []);
    if (news[0]) return { url: news[0].url, credit: news[0].credit };
    const free = await this.imageSearch.search(piece.title).catch(() => []);
    return free[0] ? { url: free[0].url, credit: free[0].credit } : null;
  }

  /** Guarda un arreglo con el servicio de cada tipo (que deja copia en el historial de versiones). */
  private async save(
    piece: ReviewPiece,
    patch: { seo?: Seo; image?: { url: string; credit: string }; content?: ContentBlock[]; title?: string; summary?: string },
  ): Promise<void> {
    const toc = patch.content
      ? patch.content.filter((b) => b.heading?.trim()).map((b) => ({ id: slugify(b.heading!.trim()), label: b.heading!.trim() }))
      : undefined;
    const lamira = {
      ...(patch.seo && { seo: patch.seo }),
      ...(patch.image && { imageUrl: patch.image.url, imageCredit: patch.image.credit }),
      ...(patch.content && { content: patch.content, toc }),
      ...(patch.title && { title: patch.title }),
      ...(patch.summary && { dek: patch.summary }),
    };
    const planazo = {
      ...(patch.seo && { seo: patch.seo }),
      ...(patch.content && { content: patch.content }),
      ...(patch.title && { name: patch.title }),
      ...(patch.summary && { description: patch.summary }),
    };
    switch (piece.type) {
      case 'noticia':
        await this.noticiasService.update(piece.id, lamira);
        break;
      case 'reportaje':
        await this.reportajesService.update(piece.id, lamira);
        break;
      case 'guia':
        await this.guiasService.update(piece.id, lamira as never);
        break;
      case 'place':
        await this.placesService.update(piece.id, { ...planazo, ...(patch.image && { photo: { url: patch.image.url, credit: patch.image.credit } }) });
        break;
      case 'evento-planazo':
        await this.eventsService.update(piece.id, { ...planazo, ...(patch.image && { imageUrl: patch.image.url, imageCredit: patch.image.credit }) });
        break;
      case 'planazo-guia':
        await this.planazoGuidesService.update(piece.id, {
          ...(patch.seo && { seo: patch.seo }),
          ...(patch.image && { imageUrl: patch.image.url, imageCredit: patch.image.credit }),
          ...(patch.title && { title: patch.title }),
          ...(patch.summary && { description: patch.summary }),
        });
        break;
    }
  }

  /** Segunda opinión con IA: ¿encaja en el sitio, es coherente, inventa, sirve al lector? */
  async analyze(type: ReviewableType, id: string, actorId?: string, choice: AiProviderChoice = 'default'): Promise<AiReview & { checks: ReviewEvaluation['checks']; reviewedAt: string }> {
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
    const provider = await this.providers.resolveProvider(choice);
    const output = (await this.providers.generateWithFallback(provider, {
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
    }, { fallback: choice === 'default' })) as AiReview;

    const reviewedAt = new Date();
    const site = await this.db.query.sites.findFirst({ where: eq(sites.slug, piece.site) });
    if (site) {
      await this.db.insert(contentAuditLog).values({
        siteId: site.id,
        contentType: piece.type,
        contentId: piece.id,
        mode: REVIEW_MODE,
        sourceContext: { contentHash: contentHash(piece) },
        aiModel: provider,
        aiOutput: output as unknown as Record<string, unknown>,
        checksRun: evaluation.checks.map((c) => ({ name: c.id, passed: c.passed, blocking: c.blocking, detail: c.detail })),
        decision: 'needs-review',
        statusBefore: piece.status as never,
        statusAfter: piece.status as never,
        actorId: actorId ?? null,
        createdAt: reviewedAt,
      });
    }

    return { ...output, checks: evaluation.checks, reviewedAt: reviewedAt.toISOString() };
  }

  /** Última revisión con IA de cada pieza (clave `tipo:id`). */
  private async savedReviews(ids: string[]): Promise<Map<string, { review: AiReview; reviewedAt: string; hash: string | null }>> {
    const out = new Map<string, { review: AiReview; reviewedAt: string; hash: string | null }>();
    if (!ids.length) return out;
    const rows = await this.db
      .select({
        contentType: contentAuditLog.contentType,
        contentId: contentAuditLog.contentId,
        aiOutput: contentAuditLog.aiOutput,
        sourceContext: contentAuditLog.sourceContext,
        createdAt: contentAuditLog.createdAt,
      })
      .from(contentAuditLog)
      .where(and(eq(contentAuditLog.mode, REVIEW_MODE), inArray(contentAuditLog.contentId, ids)))
      .orderBy(desc(contentAuditLog.createdAt));
    for (const r of rows) {
      const key = `${r.contentType}:${r.contentId}`;
      if (out.has(key)) continue; // ya tenemos la más reciente
      out.set(key, {
        review: r.aiOutput as unknown as AiReview,
        reviewedAt: r.createdAt.toISOString(),
        hash: (r.sourceContext?.contentHash as string | undefined) ?? null,
      });
    }
    return out;
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
            type: 'noticia', site: 'la-mira', id: r.id, slug: r.slug, title: r.title, summary: r.dek, ...blockText(r.content),
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
            type: 'reportaje', site: 'la-mira', id: r.id, slug: r.slug, title: r.title, summary: r.dek, ...blockText(r.content),
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
            type: 'guia', site: 'la-mira', id: r.id, slug: r.slug, title: r.title, summary: r.dek, ...blockText(r.content as ContentBlock[]),
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
            type: 'place', site: 'planazo', id: r.id, slug: r.slug, title: r.name, summary: r.description ?? '', ...blockText(r.content as ContentBlock[]),
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
            type: 'evento-planazo', site: 'planazo', id: r.id, slug: r.slug, title: r.name, summary: r.description ?? '', ...blockText(r.content),
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
            type: 'planazo-guia', site: 'planazo', id: r.id, slug: r.slug, title: r.title, summary: r.description,
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
