import { Inject, Injectable } from '@nestjs/common';
import { and, eq, gte, lt } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import * as schema from '../../db/schema';

export interface CalendarItem {
  contentType: string;
  contentId: string;
  title: string;
  site: 'la-mira' | 'planazo';
  date: string;
}

// Registro real de publicaciones por mes, para el Calendario Editorial. Solo
// noticia/reportaje tienen un `publishedAt` propio (fecha real de
// publicación) — el resto de los tipos con workflow de borrador (guia,
// place, evento-planazo, planazo-guia) no lo tienen, así que se usa
// `createdAt` como mejor referencia disponible. alerta/evento/lugar (La
// Mira) no tienen `status` (se publican de inmediato al crearse, ver
// HAS_DRAFT_WORKFLOW en el CMS) — cuentan todas, con su `createdAt`. Mismo
// criterio de "9 consultas explícitas" que DashboardService: Drizzle no
// tipa bien `.from(tablaVariable)` cuando la tabla se resuelve en runtime.
@Injectable()
export class CalendarService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async getMonth(year: number, month: number): Promise<CalendarItem[]> {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);

    const [noticias, reportajes, guias, places, events, planazoGuides, alertas, lamiraEventos, lamiraLugares] = await Promise.all([
      this.db
        .select({ id: schema.noticias.id, title: schema.noticias.title, date: schema.noticias.publishedAt })
        .from(schema.noticias)
        .where(and(eq(schema.noticias.status, 'published'), gte(schema.noticias.publishedAt, start), lt(schema.noticias.publishedAt, end))),
      this.db
        .select({ id: schema.reportajes.id, title: schema.reportajes.title, date: schema.reportajes.publishedAt })
        .from(schema.reportajes)
        .where(and(eq(schema.reportajes.status, 'published'), gte(schema.reportajes.publishedAt, start), lt(schema.reportajes.publishedAt, end))),
      this.db
        .select({ id: schema.guias.id, title: schema.guias.title, date: schema.guias.createdAt })
        .from(schema.guias)
        .where(and(eq(schema.guias.status, 'published'), gte(schema.guias.createdAt, start), lt(schema.guias.createdAt, end))),
      this.db
        .select({ id: schema.places.id, title: schema.places.name, date: schema.places.createdAt })
        .from(schema.places)
        .where(and(eq(schema.places.status, 'published'), gte(schema.places.createdAt, start), lt(schema.places.createdAt, end))),
      this.db
        .select({ id: schema.events.id, title: schema.events.name, date: schema.events.createdAt })
        .from(schema.events)
        .where(and(eq(schema.events.status, 'published'), gte(schema.events.createdAt, start), lt(schema.events.createdAt, end))),
      this.db
        .select({ id: schema.planazoGuides.id, title: schema.planazoGuides.title, date: schema.planazoGuides.createdAt })
        .from(schema.planazoGuides)
        .where(and(eq(schema.planazoGuides.status, 'published'), gte(schema.planazoGuides.createdAt, start), lt(schema.planazoGuides.createdAt, end))),
      this.db
        .select({ id: schema.alertas.id, title: schema.alertas.title, date: schema.alertas.createdAt })
        .from(schema.alertas)
        .where(and(gte(schema.alertas.createdAt, start), lt(schema.alertas.createdAt, end))),
      this.db
        .select({ id: schema.lamiraEventos.id, title: schema.lamiraEventos.title, date: schema.lamiraEventos.createdAt })
        .from(schema.lamiraEventos)
        .where(and(gte(schema.lamiraEventos.createdAt, start), lt(schema.lamiraEventos.createdAt, end))),
      this.db
        .select({ id: schema.lamiraLugares.id, title: schema.lamiraLugares.name, date: schema.lamiraLugares.createdAt })
        .from(schema.lamiraLugares)
        .where(and(gte(schema.lamiraLugares.createdAt, start), lt(schema.lamiraLugares.createdAt, end))),
    ]);

    const tag = (rows: { id: string; title: string; date: Date }[], contentType: string, site: 'la-mira' | 'planazo'): CalendarItem[] =>
      rows.map((r) => ({ contentType, contentId: r.id, title: r.title, site, date: r.date.toISOString() }));

    return [
      ...tag(noticias, 'noticia', 'la-mira'),
      ...tag(reportajes, 'reportaje', 'la-mira'),
      ...tag(guias, 'guia', 'la-mira'),
      ...tag(places, 'place', 'planazo'),
      ...tag(events, 'evento-planazo', 'planazo'),
      ...tag(planazoGuides, 'planazo-guia', 'planazo'),
      ...tag(alertas, 'alerta', 'la-mira'),
      ...tag(lamiraEventos, 'evento', 'la-mira'),
      ...tag(lamiraLugares, 'lugar', 'la-mira'),
    ].sort((a, b) => a.date.localeCompare(b.date));
  }
}
