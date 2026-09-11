import { Inject, Injectable } from '@nestjs/common';
import { and, count, desc, asc, eq, gte, inArray, lt } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import * as schema from '../../db/schema';

const DAY_MS = 24 * 60 * 60 * 1000;
const STALE_IN_REVIEW_DAYS = 3;
const RECENT_LIMIT_PER_TABLE = 8;
const STALE_LIMIT_PER_TABLE = 6;

interface ContentItem {
  contentType: string;
  contentId: string;
  title: string;
  site: 'la-mira' | 'planazo';
  at: Date;
}

export interface DashboardStats {
  counts: { published: number; draft: number; inReview: number; scheduled: number };
  aiGeneratedTotal: number;
  aiGeneratedLast30Days: number;
  recentlyCreated: ContentItem[];
  staleContent: (ContentItem & { daysSinceUpdate: number })[];
  alerts: { title: string; meta: string }[];
}

// Nota general: cada tipo de contenido vive en su propia tabla con nombres de
// columna distintos (title vs name) y algunos sin `status`/`updatedAt` real
// (ver comentarios de cada bloque) — se escribe cada consulta explícita por
// tipo, en vez de un loop genérico sobre las tablas, porque Drizzle no puede
// tipar `.from(tablaVariable)`/`.groupBy(columnaVariable)` de forma segura
// cuando la tabla se resuelve en runtime (mismo criterio que
// content-versions.service.ts: 9 casos concretos en vez de pelear el sistema
// de tipos).
@Injectable()
export class DashboardService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async getStats(): Promise<DashboardStats> {
    const [counts, aiTotals, recentlyCreated, staleContent, alerts] = await Promise.all([
      this.getCounts(),
      this.getAiGeneratedTotals(),
      this.getRecentlyCreated(),
      this.getStaleContent(),
      this.getAlerts(),
    ]);

    return { counts, aiGeneratedTotal: aiTotals.total, aiGeneratedLast30Days: aiTotals.last30Days, recentlyCreated, staleContent, alerts };
  }

  // Solo 6 de los 9 tipos tienen workflow de borrador/revisión real
  // (CONTENT_STATUS_VALUES) — alerta, evento (La Mira) y lugar (La Mira) se
  // publican de inmediato al crearse y no tienen columna `status` (ver
  // lamira-contenido-view.tsx, HAS_DRAFT_WORKFLOW). Esas 3 se cuentan aparte,
  // siempre como "publicado".
  private async getCounts(): Promise<DashboardStats['counts']> {
    const result = { published: 0, draft: 0, inReview: 0, scheduled: 0 };
    const add = (rows: { status: string; n: number }[]) => {
      for (const row of rows) {
        if (row.status === 'published') result.published += row.n;
        else if (row.status === 'draft') result.draft += row.n;
        else if (row.status === 'in_review') result.inReview += row.n;
        else if (row.status === 'scheduled') result.scheduled += row.n;
        else result.published += row.n; // 'archived' — sin bucket propio
      }
    };

    add(await this.db.select({ status: schema.noticias.status, n: count() }).from(schema.noticias).groupBy(schema.noticias.status));
    add(await this.db.select({ status: schema.guias.status, n: count() }).from(schema.guias).groupBy(schema.guias.status));
    add(await this.db.select({ status: schema.reportajes.status, n: count() }).from(schema.reportajes).groupBy(schema.reportajes.status));
    add(await this.db.select({ status: schema.places.status, n: count() }).from(schema.places).groupBy(schema.places.status));
    add(await this.db.select({ status: schema.events.status, n: count() }).from(schema.events).groupBy(schema.events.status));
    add(await this.db.select({ status: schema.planazoGuides.status, n: count() }).from(schema.planazoGuides).groupBy(schema.planazoGuides.status));

    const [[alertasRow], [eventosRow], [lugaresRow]] = await Promise.all([
      this.db.select({ n: count() }).from(schema.alertas),
      this.db.select({ n: count() }).from(schema.lamiraEventos),
      this.db.select({ n: count() }).from(schema.lamiraLugares),
    ]);
    result.published += (alertasRow?.n ?? 0) + (eventosRow?.n ?? 0) + (lugaresRow?.n ?? 0);

    return result;
  }

  private async getAiGeneratedTotals(): Promise<{ total: number; last30Days: number }> {
    const thirtyDaysAgo = new Date(Date.now() - 30 * DAY_MS);
    const createdOutcomes = ['published', 'draft'] as const;

    const [[totalRow], [recentRow]] = await Promise.all([
      this.db.select({ n: count() }).from(schema.automationRuns).where(inArray(schema.automationRuns.outcome, createdOutcomes)),
      this.db
        .select({ n: count() })
        .from(schema.automationRuns)
        .where(and(inArray(schema.automationRuns.outcome, createdOutcomes), gte(schema.automationRuns.ranAt, thirtyDaysAgo))),
    ]);

    return { total: totalRow?.n ?? 0, last30Days: recentRow?.n ?? 0 };
  }

  private async getRecentlyCreated(): Promise<ContentItem[]> {
    const [noticias, guias, reportajes, places, events, planazoGuides, alertas, lamiraEventos, lamiraLugares] = await Promise.all([
      this.db
        .select({ id: schema.noticias.id, title: schema.noticias.title, at: schema.noticias.createdAt })
        .from(schema.noticias)
        .where(eq(schema.noticias.status, 'published'))
        .orderBy(desc(schema.noticias.createdAt))
        .limit(RECENT_LIMIT_PER_TABLE),
      this.db
        .select({ id: schema.guias.id, title: schema.guias.title, at: schema.guias.createdAt })
        .from(schema.guias)
        .where(eq(schema.guias.status, 'published'))
        .orderBy(desc(schema.guias.createdAt))
        .limit(RECENT_LIMIT_PER_TABLE),
      this.db
        .select({ id: schema.reportajes.id, title: schema.reportajes.title, at: schema.reportajes.createdAt })
        .from(schema.reportajes)
        .where(eq(schema.reportajes.status, 'published'))
        .orderBy(desc(schema.reportajes.createdAt))
        .limit(RECENT_LIMIT_PER_TABLE),
      this.db
        .select({ id: schema.places.id, title: schema.places.name, at: schema.places.createdAt })
        .from(schema.places)
        .where(eq(schema.places.status, 'published'))
        .orderBy(desc(schema.places.createdAt))
        .limit(RECENT_LIMIT_PER_TABLE),
      this.db
        .select({ id: schema.events.id, title: schema.events.name, at: schema.events.createdAt })
        .from(schema.events)
        .where(eq(schema.events.status, 'published'))
        .orderBy(desc(schema.events.createdAt))
        .limit(RECENT_LIMIT_PER_TABLE),
      this.db
        .select({ id: schema.planazoGuides.id, title: schema.planazoGuides.title, at: schema.planazoGuides.createdAt })
        .from(schema.planazoGuides)
        .where(eq(schema.planazoGuides.status, 'published'))
        .orderBy(desc(schema.planazoGuides.createdAt))
        .limit(RECENT_LIMIT_PER_TABLE),
      this.db
        .select({ id: schema.alertas.id, title: schema.alertas.title, at: schema.alertas.createdAt })
        .from(schema.alertas)
        .orderBy(desc(schema.alertas.createdAt))
        .limit(RECENT_LIMIT_PER_TABLE),
      this.db
        .select({ id: schema.lamiraEventos.id, title: schema.lamiraEventos.title, at: schema.lamiraEventos.createdAt })
        .from(schema.lamiraEventos)
        .orderBy(desc(schema.lamiraEventos.createdAt))
        .limit(RECENT_LIMIT_PER_TABLE),
      this.db
        .select({ id: schema.lamiraLugares.id, title: schema.lamiraLugares.name, at: schema.lamiraLugares.createdAt })
        .from(schema.lamiraLugares)
        .orderBy(desc(schema.lamiraLugares.createdAt))
        .limit(RECENT_LIMIT_PER_TABLE),
    ]);

    const tag = (rows: { id: string; title: string; at: Date }[], contentType: string, site: 'la-mira' | 'planazo'): ContentItem[] =>
      rows.map((r) => ({ contentType, contentId: r.id, title: r.title, site, at: r.at }));

    return [
      ...tag(noticias, 'noticia', 'la-mira'),
      ...tag(guias, 'guia', 'la-mira'),
      ...tag(reportajes, 'reportaje', 'la-mira'),
      ...tag(places, 'place', 'planazo'),
      ...tag(events, 'evento-planazo', 'planazo'),
      ...tag(planazoGuides, 'planazo-guia', 'planazo'),
      ...tag(alertas, 'alerta', 'la-mira'),
      ...tag(lamiraEventos, 'evento', 'la-mira'),
      ...tag(lamiraLugares, 'lugar', 'la-mira'),
    ]
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, 8);
  }

  // Solo los 4 tipos con `updatedAt` real (noticia, guia, place, planazo-guia)
  // — reportaje/evento-planazo no tienen esa columna, y alerta/evento/lugar
  // (La Mira) no tienen workflow de edición con revisión, así que no aplica.
  private async getStaleContent(): Promise<(ContentItem & { daysSinceUpdate: number })[]> {
    const now = Date.now();
    const [noticias, guias, places, planazoGuides] = await Promise.all([
      this.db
        .select({ id: schema.noticias.id, title: schema.noticias.title, at: schema.noticias.updatedAt })
        .from(schema.noticias)
        .where(eq(schema.noticias.status, 'published'))
        .orderBy(asc(schema.noticias.updatedAt))
        .limit(STALE_LIMIT_PER_TABLE),
      this.db
        .select({ id: schema.guias.id, title: schema.guias.title, at: schema.guias.updatedAt })
        .from(schema.guias)
        .where(eq(schema.guias.status, 'published'))
        .orderBy(asc(schema.guias.updatedAt))
        .limit(STALE_LIMIT_PER_TABLE),
      this.db
        .select({ id: schema.places.id, title: schema.places.name, at: schema.places.updatedAt })
        .from(schema.places)
        .where(eq(schema.places.status, 'published'))
        .orderBy(asc(schema.places.updatedAt))
        .limit(STALE_LIMIT_PER_TABLE),
      this.db
        .select({ id: schema.planazoGuides.id, title: schema.planazoGuides.title, at: schema.planazoGuides.updatedAt })
        .from(schema.planazoGuides)
        .where(eq(schema.planazoGuides.status, 'published'))
        .orderBy(asc(schema.planazoGuides.updatedAt))
        .limit(STALE_LIMIT_PER_TABLE),
    ]);

    const tag = (
      rows: { id: string; title: string; at: Date | null }[],
      contentType: string,
      site: 'la-mira' | 'planazo',
    ): (ContentItem & { daysSinceUpdate: number })[] =>
      rows
        .filter((r): r is { id: string; title: string; at: Date } => !!r.at)
        .map((r) => ({ contentType, contentId: r.id, title: r.title, site, at: r.at, daysSinceUpdate: Math.floor((now - r.at.getTime()) / DAY_MS) }));

    return [...tag(noticias, 'noticia', 'la-mira'), ...tag(guias, 'guia', 'la-mira'), ...tag(places, 'place', 'planazo'), ...tag(planazoGuides, 'planazo-guia', 'planazo')]
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, 4);
  }

  private async getAlerts(): Promise<{ title: string; meta: string }[]> {
    const alerts: { title: string; meta: string }[] = [];

    const [photoPlaceIds, publishedPlaces] = await Promise.all([
      this.db.selectDistinct({ placeId: schema.photos.placeId }).from(schema.photos),
      this.db.select({ id: schema.places.id }).from(schema.places).where(eq(schema.places.status, 'published')),
    ]);
    const withPhoto = new Set(photoPlaceIds.map((p) => p.placeId));
    const withoutPhoto = publishedPlaces.filter((p) => !withPhoto.has(p.id)).length;
    if (withoutPhoto > 0) {
      alerts.push({ title: `${withoutPhoto} ${withoutPhoto === 1 ? 'lugar publicado sin foto' : 'lugares publicados sin foto'}`, meta: 'Planazo · Contenido' });
    }

    const cutoff = new Date(Date.now() - STALE_IN_REVIEW_DAYS * DAY_MS);
    const [[n1], [n2], [n3], [n4], [n5], [n6]] = await Promise.all([
      this.db.select({ n: count() }).from(schema.noticias).where(and(eq(schema.noticias.status, 'in_review'), lt(schema.noticias.createdAt, cutoff))),
      this.db.select({ n: count() }).from(schema.guias).where(and(eq(schema.guias.status, 'in_review'), lt(schema.guias.createdAt, cutoff))),
      this.db.select({ n: count() }).from(schema.reportajes).where(and(eq(schema.reportajes.status, 'in_review'), lt(schema.reportajes.createdAt, cutoff))),
      this.db.select({ n: count() }).from(schema.places).where(and(eq(schema.places.status, 'in_review'), lt(schema.places.createdAt, cutoff))),
      this.db.select({ n: count() }).from(schema.events).where(and(eq(schema.events.status, 'in_review'), lt(schema.events.createdAt, cutoff))),
      this.db.select({ n: count() }).from(schema.planazoGuides).where(and(eq(schema.planazoGuides.status, 'in_review'), lt(schema.planazoGuides.createdAt, cutoff))),
    ]);
    const staleInReview = (n1?.n ?? 0) + (n2?.n ?? 0) + (n3?.n ?? 0) + (n4?.n ?? 0) + (n5?.n ?? 0) + (n6?.n ?? 0);
    if (staleInReview > 0) {
      alerts.push({
        title: `${staleInReview} ${staleInReview === 1 ? 'pieza lleva' : 'piezas llevan'} más de ${STALE_IN_REVIEW_DAYS} días en revisión`,
        meta: 'Requiere aprobación manual',
      });
    }

    return alerts;
  }
}
