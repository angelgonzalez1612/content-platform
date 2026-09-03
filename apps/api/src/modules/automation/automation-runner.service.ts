import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { slugify } from '@planazo/shared';
import type { Category, ContentBlock, Seo } from '@planazo/types';
import { AiDraftService, type DraftResult } from '../ai/ai-draft.service';
import { getContentTypeConfig } from '../ai/content-types';
import { CategoriesService } from '../categories/categories.service';
import { ContentRadarPublishedService } from '../content-radar-published/content-radar-published.service';
import { PlacesService } from '../places/places.service';
import { EventsService } from '../events/events.service';
import { NoticiasService } from '../lamira-noticias/noticias.service';
import { AlertasService } from '../lamira-alertas/alertas.service';
import { ReportajesService } from '../lamira-reportajes/reportajes.service';
import { AutomationRulesService } from './automation-rules.service';
import { AUTOMATABLE_CONTENT_TYPES } from './dto/automation-rule.dto';
import type { AutomationRuleRow } from '../../db/schema';

// Cada cuánto revisa solo, mientras la API esté prendida — no es un cron a
// hora fija: mientras el proceso viva, cada 15 min vuelve a mirar el reporte
// del día contra las reglas activas. Barato aunque no encuentre nada nuevo:
// los temas ya evaluados (publicados, en borrador, o descartados por no
// encajar) se saltan sin gastar otra llamada de IA — ver alreadyEvaluated en
// run(). Si la API se apaga y se prende más tarde, en cuanto vuelva a
// arrancar retoma solo, sin depender de pegarle exacto a una hora.
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

type AutomatableType = (typeof AUTOMATABLE_CONTENT_TYPES)[number];

interface RuleState {
  rule: AutomationRuleRow;
  createdCount: number;
}

interface ExtractedTopic {
  title: string;
  hints: string;
  categoryLabel: string;
  sites: string[];
}

// Tema real (con artículo/fuente) o frase de "Qué busca la gente (frases)"
// tratada como semilla — mismo shape para poder reusar todo el pipeline de
// assignTopic/classifyTopic/finalizeCreate, distinguidas solo por `source`
// (gatea qué reglas la consideran candidata, ver ruleCouldMatch en run(), y
// queda en la bitácora para que la pantalla de Automatizaciones pueda
// separarlas — ver getQueueStatus).
interface Topic extends ExtractedTopic {
  source: 'report' | 'search-phrase';
}

const SEARCH_PHRASE_CATEGORY_LABEL = 'Qué busca la gente (frase real)';

function toSearchPhraseTopic(phrase: string): Topic {
  return { title: phrase, hints: '', categoryLabel: SEARCH_PHRASE_CATEGORY_LABEL, sites: [], source: 'search-phrase' };
}

export interface PendingTopic {
  title: string;
  categoryLabel: string;
  hasCandidateRule: boolean;
  source: 'report' | 'search-phrase';
}

// Mismo criterio que ContentRadarPublishedService/render.ts (normaliza antes
// de comparar por título) — copiado en vez de importado para no acoplar esta
// comparación puntual a todo lo que arrastra el módulo de render.
function normalizeTitle(title: string): string {
  return title.trim().replace(/\s+/g, ' ').toLowerCase();
}

function buildToc(content: ContentBlock[]): { id: string; label: string }[] {
  return content
    .filter((b) => b.heading?.trim())
    .map((b) => ({ id: slugify(b.heading!.trim()), label: b.heading!.trim() }));
}

// Motor de "se publican solos" (ver AutomationRulesService para las reglas
// que lo configuran) — mientras la API esté prendida, revisa el reporte del
// día contra las reglas activas cada CHECK_INTERVAL_MS (ver arriba), no a una
// hora fija: si el proceso se apaga y se prende más tarde, retoma solo en el
// siguiente tick, sin depender de estar corriendo justo a las 7am. Solo 5 de
// los 8 tipos de contenido son automatizables de principio a fin (ver
// AUTOMATABLE_CONTENT_TYPES) — los otros 3 requieren datos verificables que
// la IA no puede inventar y sin los que ni siquiera se puede crear la fila
// (groupSlug de guía, fecha/hora/lugar/organizador de evento la-mira,
// alcaldía de lugar la-mira).
@Injectable()
export class AutomationRunnerService {
  private readonly logger = new Logger(AutomationRunnerService.name);
  // Bandera en memoria (no en DB, se pierde si el proceso se reinicia — no
  // pasa nada, vuelve a false) para que la pantalla de Dashboard pueda
  // mostrar "ejecutando ahora" sin adivinar a partir de timestamps.
  private runningFlag = false;

  get isRunning(): boolean {
    return this.runningFlag;
  }

  constructor(
    private readonly rules: AutomationRulesService,
    private readonly aiDraft: AiDraftService,
    private readonly categories: CategoriesService,
    private readonly contentRadarPublished: ContentRadarPublishedService,
    private readonly places: PlacesService,
    private readonly events: EventsService,
    private readonly noticias: NoticiasService,
    private readonly alertas: AlertasService,
    private readonly reportajes: ReportajesService,
  ) {}

  @Interval(CHECK_INTERVAL_MS)
  async runScheduled() {
    await this.run();
  }

  // Solo la mitad "conoce la DB" del cruce sitio↔categoría — la otra mitad
  // (qué categorías de content-radar existen y su cmsCategorySlugs) vive en
  // apps/content-radar/src/sites.ts, cruzada en extractTopics() (mismo
  // criterio que buildCategorySiteMap() en apps/cms/src/app/content-radar/page.tsx).
  private async buildSlugToSites(): Promise<Record<string, string[]>> {
    const [lamiraCats, planazoCats] = await Promise.all([
      this.categories.findAll('la-mira'),
      this.categories.findAll('planazo'),
    ]);
    const map = new Map<string, Set<string>>();
    for (const [site, cats] of [
      ['la-mira', lamiraCats],
      ['planazo', planazoCats],
    ] as const) {
      for (const c of cats) {
        if (!map.has(c.slug)) map.set(c.slug, new Set());
        map.get(c.slug)!.add(site);
      }
    }
    return Object.fromEntries([...map].map(([slug, sites]) => [slug, [...sites]]));
  }

  // apps/content-radar es un paquete ESM puro ("type":"module") — desde este
  // proceso CommonJS (compilado con nodenext) un require() estático no puede
  // cargarlo directo. import() dinámico sí puede (es el mecanismo oficial de
  // interop CJS→ESM de Node) — antes esto se resolvía con un subproceso tsx,
  // pero eso asumía que el binario tsx quedara disponible en el entorno de
  // ejecución, y en la función serverless de Vercel no queda empaquetado
  // (ENOENT). content-radar ahora compila a JS real (ver su package.json) —
  // import() directo funciona en local y en producción por igual, sin
  // depender de ningún binario externo.
  private async extractTopics(): Promise<{ fileName: string | null; topics: ExtractedTopic[]; searchPhrases: string[] }> {
    const [{ listReports, readReportFile, extractTopics: extractTopicsFromReport, extractSearchPhrases }, { DEFAULT_SITE_ID, getSite }] =
      await Promise.all([
        import('@planazo/content-radar/render') as Promise<typeof import('@planazo/content-radar/render')>,
        import('@planazo/content-radar/sites') as Promise<typeof import('@planazo/content-radar/sites')>,
      ]);

    const slugToSites = await this.buildSlugToSites();
    // Mismo cruce que hacía automation-extract-cli.ts: categorías de
    // content-radar → qué sitio(s) del CMS las cubren, vía cmsCategorySlugs.
    const categorySiteMap = new Map<string, Set<string>>();
    for (const category of getSite(DEFAULT_SITE_ID).categories) {
      const sites = new Set<string>();
      for (const slug of category.cmsCategorySlugs ?? []) {
        for (const site of slugToSites[slug] ?? []) sites.add(site);
      }
      if (sites.size > 0) categorySiteMap.set(category.label, sites);
    }

    const files = await listReports(DEFAULT_SITE_ID);
    const fileName = files[0] ?? null;
    if (!fileName) return { fileName: null, topics: [], searchPhrases: [] };

    const raw = await readReportFile(fileName);
    const topics = (await extractTopicsFromReport(raw, categorySiteMap as never)) as ExtractedTopic[];
    const searchPhrases = extractSearchPhrases(raw);
    return { fileName, topics, searchPhrases };
  }

  /** Corrida real — expuesta aparte de runScheduled() para que el endpoint
   * "Ejecutar ahora" de la pantalla de Automatizaciones dispare exactamente lo
   * mismo que la corrida automática del interval, sin duplicar lógica. */
  async run(): Promise<{ evaluated: number; created: number }> {
    this.runningFlag = true;
    try {
      await this.rules.touchLastChecked();

      const activeRules = await this.rules.findActive();
      if (activeRules.length === 0) return { evaluated: 0, created: 0 };

      const { fileName, topics, searchPhrases } = await this.extractTopics();
      if (!fileName) {
        this.logger.warn('No hay reportes de content-radar todavía — nada que evaluar.');
        return { evaluated: 0, created: 0 };
      }

      const [alreadyPublished, alreadyEvaluated, todaysCounts] = await Promise.all([
        this.contentRadarPublished.findAllTitles().then((titles) => new Set(titles.map(normalizeTitle))),
        this.rules.alreadyEvaluatedTitles(),
        this.rules.todaysCreatedCountByRule(),
      ]);
      const handledThisRun = new Set<string>();
      const ruleStates: RuleState[] = activeRules.map((rule) => ({ rule, createdCount: todaysCounts.get(rule.id) ?? 0 }));

      let created = 0;
      let evaluated = 0;

      const allTopics: Topic[] = [
        ...topics.map((t) => ({ ...t, source: 'report' as const })),
        ...searchPhrases.map(toSearchPhraseTopic),
      ];

      for (const topic of allTopics) {
        const key = normalizeTitle(topic.title);
        if (handledThisRun.has(key)) continue; // mismo tema repetido en "Lo más caliente" + su categoría
        handledThisRun.add(key);

        // Silencioso a propósito (ver comentario en alreadyEvaluatedTitles) —
        // con el interval corriendo cada 15 min, loguear esto cada vez ensucia
        // la bitácora sin decir nada nuevo después del primer aviso.
        if (alreadyPublished.has(key) || alreadyEvaluated.has(key)) continue;

        const candidates = ruleStates.filter(
          (state) =>
            state.createdCount < state.rule.dailyLimit &&
            this.ruleCouldMatch(state.rule, topic) &&
            (topic.source !== 'search-phrase' || state.rule.includeSearchPhrases),
        );
        if (candidates.length === 0) continue;

        evaluated += 1;
        if (await this.assignTopic(candidates, topic)) created += 1;
      }

      return { evaluated, created };
    } finally {
      this.runningFlag = false;
    }
  }

  /** "Cola pendiente" del Dashboard — temas de hoy que todavía no se
   * evaluaron ni publicaron, sin gastar ninguna llamada de IA (extractTopics
   * solo lee/parsea el reporte del día, la clasificación real es lo caro).
   * `hasCandidateRule` es el mismo filtro barato de sitio que usa run(), así
   * la pantalla puede distinguir "va a intentarse en el próximo tick" de
   * "nadie lo va a tocar, ninguna regla activa aplica a su sitio". */
  async getQueueStatus(): Promise<{ totalTopics: number; alreadyHandled: number; pending: PendingTopic[] }> {
    const activeRules = await this.rules.findActive();
    const { fileName, topics, searchPhrases } = await this.extractTopics();
    if (!fileName) return { totalTopics: 0, alreadyHandled: 0, pending: [] };

    const [alreadyPublished, alreadyEvaluated] = await Promise.all([
      this.contentRadarPublished.findAllTitles().then((titles) => new Set(titles.map(normalizeTitle))),
      this.rules.alreadyEvaluatedTitles(),
    ]);

    const seen = new Set<string>();
    const pending: PendingTopic[] = [];
    let alreadyHandled = 0;

    const allTopics: Topic[] = [
      ...topics.map((t) => ({ ...t, source: 'report' as const })),
      ...searchPhrases.map(toSearchPhraseTopic),
    ];

    for (const topic of allTopics) {
      const key = normalizeTitle(topic.title);
      if (seen.has(key)) continue;
      seen.add(key);

      if (alreadyPublished.has(key) || alreadyEvaluated.has(key)) {
        alreadyHandled += 1;
        continue;
      }

      pending.push({
        title: topic.title,
        categoryLabel: topic.categoryLabel,
        hasCandidateRule: activeRules.some(
          (rule) => this.ruleCouldMatch(rule, topic) && (topic.source !== 'search-phrase' || rule.includeSearchPhrases),
        ),
        source: topic.source,
      });
    }

    return { totalTopics: seen.size, alreadyHandled, pending };
  }

  /** Filtro barato ANTES de gastar una llamada a IA — usa el mapeo de sitio
   * que content-radar ya trae por categoría (grueso, no perfecto). La
   * clasificación real de sitio/tipo/categoría la hace la IA después; esto
   * solo evita intentar reglas obviamente del sitio equivocado. Un tema sin
   * sitio conocido (ej. "Lo más caliente", cruza categorías) siempre pasa —
   * no hay con qué prefiltrarlo. */
  private ruleCouldMatch(rule: AutomationRuleRow, topic: Topic): boolean {
    if (!rule.site) return true;
    if (topic.sites.length === 0) return true;
    return topic.sites.includes(rule.site);
  }

  // Antes, la primera regla candidata (mismo sitio) se quedaba con el tema
  // pasara lo que pasara — si no aceptaba la categoría, el tema se descartaba
  // sin que las demás reglas (que sí podían encajar) llegaran a intentarlo.
  // Con 13+ reglas por sitio, la más vieja se comía prácticamente todos los
  // temas de las demás categorías. Ahora se leen/clasifican los temas y se
  // ASIGNAN a la regla cuya categoría/tipo sí acepta, probando cada regla
  // candidata en orden hasta encontrar una que encaje — reutilizando el mismo
  // borrador de IA entre reglas que piden exactamente el mismo
  // sitio+tipo+proveedor forzado, así no se multiplica el gasto de IA por
  // cada regla candidata (la clasificación no cambia entre ellas).
  private async assignTopic(candidates: RuleState[], topic: Topic): Promise<boolean> {
    const drafts = new Map<string, { result: DraftResult; category: Category } | { error: string }>();
    let lastClassified: { result: DraftResult; category: Category } | null = null;
    let lastError: string | null = null;

    for (const state of candidates) {
      const { rule } = state;
      const forcedType = rule.contentTypes.length === 1 ? (rule.contentTypes[0] as AutomatableType) : undefined;
      const forcedSite = forcedType ? getContentTypeConfig(forcedType).site : undefined;
      const cacheKey = `${forcedSite ?? '*'}|${forcedType ?? '*'}|${rule.provider}`;

      let entry = drafts.get(cacheKey);
      if (!entry) {
        entry = await this.classifyTopic(forcedSite, forcedType, rule.provider, topic);
        drafts.set(cacheKey, entry);
      }

      if ('error' in entry) {
        lastError = entry.error;
        continue;
      }

      lastClassified = entry;
      if (!this.ruleAccepts(rule, entry.result, entry.category)) continue;

      const finalResult = await this.maybeExpandContent(rule, entry.result, topic);
      return this.finalizeCreate(state, topic, finalResult, entry.category);
    }

    // Ninguna regla candidata aceptó el tema — una sola fila resumen, sin
    // adjudicarla a "la primera que se probó" (justo lo que causaba la
    // confusión antes: todo aparecía bajo el nombre de una sola regla).
    if (lastClassified) {
      await this.rules.logRun({
        ruleId: null,
        ruleName: null,
        topic: topic.title,
        categoryLabel: topic.categoryLabel,
        site: lastClassified.result.site,
        contentType: lastClassified.result.contentType,
        outcome: 'skipped_no_match',
        detail: `La IA lo clasificó como "${lastClassified.category.name}" (${lastClassified.result.contentType}) — ninguna de las ${candidates.length} regla(s) candidata(s) para este tema acepta esa categoría o tipo.`,
        source: topic.source,
      });
    } else {
      await this.rules.logRun({
        ruleId: null,
        ruleName: null,
        topic: topic.title,
        categoryLabel: topic.categoryLabel,
        outcome: 'error',
        detail: lastError ?? 'No se pudo generar el borrador con ninguna de las reglas candidatas.',
        source: topic.source,
      });
    }
    return false;
  }

  /** Un solo intento de clasificación (sitio/tipo/categoría) para una
   * combinación sitio+tipo forzado+proveedor — se cachea por esa combinación
   * en assignTopic, no por regla individual. */
  private async classifyTopic(
    forcedSite: 'la-mira' | 'planazo' | undefined,
    forcedType: AutomatableType | undefined,
    provider: AutomationRuleRow['provider'],
    topic: Topic,
  ): Promise<{ result: DraftResult; category: Category } | { error: string }> {
    try {
      const result = await this.aiDraft.draft({
        site: forcedSite,
        contentType: forcedType,
        name: topic.title,
        hints: topic.hints || undefined,
        provider,
      });
      const category = await this.categories.findOne(result.categoryId);
      return { result, category };
    } catch (err) {
      return { error: err instanceof Error ? err.message.slice(0, 300) : 'Error desconocido generando el borrador.' };
    }
  }

  /** Misma validación que antes (sitio, tipo automatizable, tipo permitido,
   * categoría permitida) pero como chequeo puro reutilizable contra varias
   * reglas candidatas para el mismo resultado ya clasificado. */
  private ruleAccepts(rule: AutomationRuleRow, result: DraftResult, category: Category): boolean {
    if (rule.site && result.site !== rule.site) return false;
    if (!AUTOMATABLE_CONTENT_TYPES.includes(result.contentType as AutomatableType)) return false;
    if (rule.contentTypes.length && !rule.contentTypes.includes(result.contentType)) return false;
    if (rule.categorySlugs.length && !rule.categorySlugs.includes(category.slug)) return false;
    return true;
  }

  /** "Agregar más contenido con IA" de la regla (checkbox en Automatizaciones)
   * — si el borrador quedó corto según el mismo check no-bloqueante
   * 'calidad-longitud' que ya corre checks.service.ts, le pide a la IA 1-3
   * secciones más antes de crear la pieza (mismo mecanismo que "Agregar
   * contenido" en la revisión manual — ver ExpandDraftPanel). Solo tiene
   * efecto en tipos cuyo borrador trae bloques de contenido reales
   * (noticia/reportaje); place/alerta/evento-planazo no traen `content` desde
   * automation (ver createContent), no hay nada que expandir ahí, así que se
   * ignora en silencio. El contenido agregado nunca pasó por los checks del
   * borrador original, así que la pieza siempre queda para revisión humana en
   * vez de publicarse sola.
   */
  private async maybeExpandContent(rule: AutomationRuleRow, result: DraftResult, topic: Topic): Promise<DraftResult> {
    if (!rule.expandIfShort) return result;

    const tooShort = result.checksRun.some((c) => c.name === 'calidad-longitud' && !c.passed);
    if (!tooShort) return result;

    const draft = result.draft as Record<string, unknown>;
    const content = draft.content as ContentBlock[] | undefined;
    if (!Array.isArray(content) || content.length === 0) return result;

    try {
      const expanded = await this.aiDraft.expandDraft({
        contentType: result.contentType,
        name: topic.title,
        description: (draft.dek as string | undefined) ?? null,
        content,
        categoryId: result.categoryId,
        provider: rule.provider,
      });
      const mergedContent = (expanded.draft as { content: ContentBlock[] }).content;
      return { ...result, draft: { ...draft, content: mergedContent }, decision: 'needs-review' };
    } catch {
      return result; // si la expansión falla, seguimos con el borrador tal cual
    }
  }

  private async finalizeCreate(state: RuleState, topic: Topic, result: DraftResult, category: Category): Promise<boolean> {
    const { rule } = state;
    const published = result.decision === 'auto-published';
    try {
      const createdRow = await this.createContent(result.contentType as AutomatableType, result, category, topic.title, published);
      await this.contentRadarPublished.markPublished({
        title: topic.title,
        site: result.site,
        contentType: result.contentType,
        contentId: createdRow.id,
      });
      await this.rules.logRun({
        ruleId: rule.id,
        ruleName: rule.name,
        topic: topic.title,
        categoryLabel: topic.categoryLabel,
        site: result.site,
        contentType: result.contentType,
        outcome: published ? 'published' : 'draft',
        contentId: createdRow.id,
        contentSlug: createdRow.slug,
        detail: published ? null : 'No pasó todos los checks automáticos — se creó como borrador, para revisión.',
        source: topic.source,
      });
      state.createdCount += 1;
      return true;
    } catch (err) {
      await this.rules.logRun({
        ruleId: rule.id,
        ruleName: rule.name,
        topic: topic.title,
        categoryLabel: topic.categoryLabel,
        site: result.site,
        contentType: result.contentType,
        outcome: 'error',
        detail: err instanceof Error ? err.message.slice(0, 300) : 'Error desconocido creando el contenido.',
        source: topic.source,
      });
      return false;
    }
  }

  private async createContent(
    contentType: AutomatableType,
    result: DraftResult,
    category: Category,
    name: string,
    published: boolean,
  ): Promise<{ id: string; slug: string }> {
    const draft = result.draft as Record<string, unknown>;
    const seo = (draft.seo as Seo | undefined) ?? null;
    const status = published ? 'published' : 'draft';

    switch (contentType) {
      case 'place': {
        const { description, suggestedTags, imageSearchQuery: _q, seo: _seo, ...categoryData } = draft as {
          description?: string;
          suggestedTags?: string[];
          imageSearchQuery?: string;
          seo?: Seo;
        };
        const created = await this.places.create({
          name,
          description: (description as string) ?? null,
          categorySlug: category.slug,
          tags: suggestedTags ?? [],
          photo: result.image,
          status,
          categoryData,
          seo,
        });
        return { id: created.id, slug: created.slug };
      }
      case 'evento-planazo': {
        const { description, imageSearchQuery: _q, seo: _seo, ...categoryData } = draft as {
          description?: string;
          imageSearchQuery?: string;
          seo?: Seo;
        };
        const created = await this.events.create({
          name,
          description: (description as string) ?? null,
          startDate: null,
          categoryId: category.id,
          imageUrl: result.image?.url ?? null,
          imageCredit: result.image?.credit ?? null,
          status,
          categoryData,
          seo,
        });
        return { id: created.id, slug: created.slug };
      }
      case 'noticia': {
        const { title, dek, content, imageSearchQuery: _q, seo: _seo, ...categoryData } = draft as {
          title?: string;
          dek?: string;
          content?: ContentBlock[];
          imageSearchQuery?: string;
          seo?: Seo;
        };
        const blocks = content ?? [];
        const created = await this.noticias.create({
          title: (title as string) ?? name,
          dek: (dek as string) ?? '',
          categoryId: category.id,
          authorSlug: 'redaccion-la-mira',
          publishedAt: new Date(),
          readingTime: '1 min',
          status,
          toc: buildToc(blocks),
          content: blocks,
          categoryData,
          seo,
          imageUrl: result.image?.url ?? null,
          imageCredit: result.image?.credit ?? null,
          sourceUrl: result.sourceUrl,
        });
        return { id: created.id, slug: created.slug };
      }
      case 'alerta': {
        const { title, description, imageSearchQuery: _q, seo: _seo, ...categoryData } = draft as {
          title?: string;
          description?: string;
          imageSearchQuery?: string;
          seo?: Seo;
        };
        const created = await this.alertas.create({
          title: (title as string) ?? name,
          alertaStatus: 'activa',
          categoryId: category.id,
          alcaldiaSlug: null,
          description: (description as string) ?? '',
          categoryData,
          seo,
          imageUrl: result.image?.url ?? null,
          imageCredit: result.image?.credit ?? null,
          content: [],
        });
        return { id: created.id, slug: created.slug };
      }
      case 'reportaje': {
        const { title, dek, content, imageSearchQuery: _q, seo: _seo, ...categoryData } = draft as {
          title?: string;
          dek?: string;
          content?: ContentBlock[];
          imageSearchQuery?: string;
          seo?: Seo;
        };
        const blocks = content ?? [];
        const created = await this.reportajes.create({
          title: (title as string) ?? name,
          dek: (dek as string) ?? '',
          authorSlug: 'redaccion-la-mira',
          categoryId: category.id,
          publishedAt: new Date(),
          readingTime: '1 min',
          status,
          tags: ['Reportaje'],
          imageCaption: 'Pendiente',
          toc: buildToc(blocks),
          content: blocks,
          categoryData,
          seo,
          imageUrl: result.image?.url ?? null,
          imageCredit: result.image?.credit ?? null,
          sourceUrl: result.sourceUrl,
        });
        return { id: created.id, slug: created.slug };
      }
    }
  }
}
