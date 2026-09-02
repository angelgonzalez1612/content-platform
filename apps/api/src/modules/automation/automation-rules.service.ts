import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { eq, and, gte, inArray } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { automationRules, automationRuns, automationState } from '../../db/schema';
import { AutomationRuleDto, UpdateAutomationRuleDto } from './dto/automation-rule.dto';

// Mismo criterio que ContentRadarPublishedService/render.ts (normaliza antes
// de comparar por título).
function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

@Injectable()
export class AutomationRulesService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  findAll() {
    return this.db.query.automationRules.findMany({ orderBy: (r, { desc }) => [desc(r.createdAt)] });
  }

  async findById(id: string) {
    const rule = await this.db.query.automationRules.findFirst({ where: eq(automationRules.id, id) });
    if (!rule) throw new NotFoundException(`Regla "${id}" no existe`);
    return rule;
  }

  // Solo activas, en orden de creación — el runner las procesa en este mismo
  // orden (la primera que aplica a un tema se la queda, ver AutomationRunnerService).
  findActive() {
    return this.db.query.automationRules.findMany({
      where: eq(automationRules.active, true),
      orderBy: (r, { asc }) => [asc(r.createdAt)],
    });
  }

  async create(dto: AutomationRuleDto) {
    const [inserted] = await this.db
      .insert(automationRules)
      .values({ ...dto, site: dto.site ?? null, updatedAt: new Date() })
      .returning({ id: automationRules.id });
    return this.findById(inserted.id);
  }

  async update(id: string, patch: UpdateAutomationRuleDto) {
    await this.findById(id);
    await this.db
      .update(automationRules)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(automationRules.id, id));
    return this.findById(id);
  }

  async remove(id: string) {
    await this.findById(id);
    await this.db.delete(automationRules).where(eq(automationRules.id, id));
  }

  // Bitácora de corridas — la pantalla de Automatizaciones la usa para mostrar
  // "qué hizo la IA" sin tener que cruzar contentAuditLog (que es por-pieza).
  findRecentRuns(limit = 100) {
    return this.db.query.automationRuns.findMany({
      orderBy: (r, { desc }) => [desc(r.ranAt)],
      limit,
    });
  }

  async logRun(entry: {
    ruleId: string | null;
    ruleName: string | null;
    topic: string;
    categoryLabel?: string;
    site?: string | null;
    contentType?: string | null;
    outcome: 'published' | 'draft' | 'skipped_duplicate' | 'skipped_no_match' | 'error';
    contentId?: string | null;
    contentSlug?: string | null;
    detail?: string | null;
    source?: 'report' | 'search-phrase';
  }) {
    await this.db.insert(automationRuns).values({
      ruleId: entry.ruleId,
      ruleName: entry.ruleName,
      topic: entry.topic,
      categoryLabel: entry.categoryLabel ?? null,
      site: (entry.site as 'la-mira' | 'planazo' | null) ?? null,
      contentType: entry.contentType ?? null,
      outcome: entry.outcome,
      contentId: entry.contentId ?? null,
      contentSlug: entry.contentSlug ?? null,
      detail: entry.detail ?? null,
      source: entry.source ?? 'report',
    });
  }

  /** "Última revisión" — se actualiza al EMPEZAR cada corrida (manual o del
   * interval), pase lo que pase después, para que la pantalla pueda mostrar
   * "sigue viva" aunque esa corrida en particular no haya publicado nada. */
  async touchLastChecked() {
    const existing = await this.db.query.automationState.findFirst({ where: eq(automationState.id, 'singleton') });
    if (existing) {
      await this.db.update(automationState).set({ lastCheckedAt: new Date() }).where(eq(automationState.id, 'singleton'));
    } else {
      await this.db.insert(automationState).values({ id: 'singleton', lastCheckedAt: new Date() });
    }
  }

  async getLastCheckedAt(): Promise<string | null> {
    const row = await this.db.query.automationState.findFirst({ where: eq(automationState.id, 'singleton') });
    return row ? row.lastCheckedAt.toISOString() : null;
  }

  /** Cuántas piezas ya creó cada regla HOY (published+draft) — sin esto, cada
   * tick del interval reiniciaría el contador en memoria y un dailyLimit:2
   * podría crear 2 piezas nuevas cada 15 minutos en vez de 2 en todo el día. */
  async todaysCreatedCountByRule(): Promise<Map<string, number>> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const rows = await this.db.query.automationRuns.findMany({
      where: and(gte(automationRuns.ranAt, startOfDay), inArray(automationRuns.outcome, ['published', 'draft'])),
      columns: { ruleId: true },
    });
    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.ruleId) continue;
      counts.set(row.ruleId, (counts.get(row.ruleId) ?? 0) + 1);
    }
    return counts;
  }

  /** Temas que ya se intentaron de verdad (se les gastó una llamada de IA, o
   * ya se crearon) — sin esto, un tema que nunca va a encajar con ninguna
   * regla se reintentaría cada 15 minutos para siempre. `skipped_duplicate`
   * NO cuenta aquí a propósito: ese es barato (nunca llegó a llamar a la IA),
   * así que si mañana ese tema deja de estar publicado en otro lado no hay
   * ningún costo en volver a mirarlo. */
  async alreadyEvaluatedTitles(): Promise<Set<string>> {
    const rows = await this.db.query.automationRuns.findMany({
      where: inArray(automationRuns.outcome, ['published', 'draft', 'skipped_no_match']),
      columns: { topic: true },
    });
    return new Set(rows.map((r) => normalizeTitle(r.topic)));
  }
}
