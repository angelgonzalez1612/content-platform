import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, inArray, notInArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { searchPhrases } from '../../db/schema';
import { WebSearchService } from './web-search.service';

// Contexto que se agrega a la frase tal cual antes de buscarla — sin esto,
// "qué hacer en fin de semana" regresa resultados genéricos de cualquier
// ciudad del mundo en vez de algo útil para La Mira/Planazo (ambos, CDMX).
const SEARCH_CONTEXT_SUFFIX = 'Ciudad de México CDMX';

@Injectable()
export class SearchPhrasesService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly webSearch: WebSearchService,
  ) {}

  findAll() {
    return this.db.query.searchPhrases.findMany({
      where: notInArray(searchPhrases.status, ['used', 'discarded']),
      orderBy: (p, { desc }) => [desc(p.createdAt)],
    });
  }

  async findById(id: string) {
    const row = await this.db.query.searchPhrases.findFirst({ where: eq(searchPhrases.id, id) });
    if (!row) throw new NotFoundException(`Frase "${id}" no existe`);
    return row;
  }

  /** Guarda las frases nuevas del extracto de hoy (ver
   * AutomationRunnerService.extractTopics) — dedupe por texto exacto, nunca
   * pisa una frase que ya existe (podría tener candidateLinks o status ya
   * avanzado). Antes esto vivía nada más en memoria, recalculado cada corrida
   * — ahora se acumula de verdad para poder revisarlas en
   * /automatizaciones/frases sin que desaparezcan al día siguiente. */
  async syncFromExtraction(phrases: string[], categoryLabel: string): Promise<void> {
    if (phrases.length === 0) return;
    // Mismo riesgo que RadarTopicsService.syncFromExtraction: si `phrases`
    // trae la misma frase repetida, ambas copias pasarían el filtro de "no
    // existe todavía" y el insert por lote tronaría con UNIQUE constraint.
    const uniquePhrases = [...new Set(phrases)];
    const existing = await this.db.query.searchPhrases.findMany({
      where: inArray(searchPhrases.phrase, uniquePhrases),
      columns: { phrase: true },
    });
    const existingSet = new Set(existing.map((r) => r.phrase));
    const toInsert = uniquePhrases.filter((p) => !existingSet.has(p));
    if (toInsert.length === 0) return;

    await this.db.insert(searchPhrases).values(toInsert.map((phrase) => ({ phrase, categoryLabel })));
  }

  /** Corre la búsqueda web real para esta frase y guarda las ligas
   * encontradas — nunca las genera/inventa la IA, siempre vienen de un
   * resultado real de Google Programmable Search (ver WebSearchService). */
  async research(id: string) {
    const row = await this.findById(id);
    const results = await this.webSearch.search(`${row.phrase} ${SEARCH_CONTEXT_SUFFIX}`);
    await this.db
      .update(searchPhrases)
      .set({ candidateLinks: results, status: 'researched', researchedAt: new Date() })
      .where(eq(searchPhrases.id, id));
    return this.findById(id);
  }

  /** El humano eligió una liga y va a generar el borrador desde Centro IA
   * (ver PublishFlow) — solo queda registro de cuál para auditoría, el
   * borrador en sí no se toca aquí. */
  async markUsed(id: string, chosenUrl: string) {
    await this.findById(id);
    await this.db.update(searchPhrases).set({ status: 'used', chosenUrl, usedAt: new Date() }).where(eq(searchPhrases.id, id));
  }

  async discard(id: string) {
    await this.findById(id);
    await this.db.update(searchPhrases).set({ status: 'discarded' }).where(eq(searchPhrases.id, id));
  }
}
