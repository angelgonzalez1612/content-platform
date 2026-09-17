import { Inject, Injectable } from '@nestjs/common';
import { inArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { radarTopics } from '../../db/schema';

/** Ver comentario en db/schema/automation.ts (radarTopics) — acumula los
 * temas del reporte de Content Radar entre corridas, dedupe por `title`,
 * para que regenerar el reporte más de una vez al día no borre temas que
 * ya estaban pendientes de evaluar. Mismo patrón que
 * SearchPhrasesService.syncFromExtraction. */
@Injectable()
export class RadarTopicsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  async syncFromExtraction(topics: { title: string; hints: string; categoryLabel: string; sites: string[] }[]): Promise<void> {
    if (topics.length === 0) return;
    // El mismo tema puede aparecer 2 veces en un solo extracto (ej. "Lo más
    // caliente" + su propia sección de categoría) — sin dedupear aquí, ambas
    // copias pasan el filtro de "no existe todavía" y el insert por lote
    // truena con UNIQUE constraint failed: radar_topics.title.
    const seenTitles = new Set<string>();
    const uniqueTopics = topics.filter((t) => (seenTitles.has(t.title) ? false : seenTitles.add(t.title)));
    const titles = uniqueTopics.map((t) => t.title);
    const existing = await this.db.query.radarTopics.findMany({
      where: inArray(radarTopics.title, titles),
      columns: { title: true },
    });
    const existingSet = new Set(existing.map((r) => r.title));
    const toInsert = uniqueTopics.filter((t) => !existingSet.has(t.title));
    if (toInsert.length === 0) return;

    await this.db.insert(radarTopics).values(toInsert);
  }

  findAll() {
    return this.db.query.radarTopics.findMany({ orderBy: (t, { asc }) => [asc(t.createdAt)] });
  }
}
