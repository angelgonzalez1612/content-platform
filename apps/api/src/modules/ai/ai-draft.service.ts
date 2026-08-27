import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import {
  categories,
  sites,
  places,
  noticias,
  alertas,
  guias,
  lamiraEventos,
  lamiraLugares,
  reportajes,
  contentAuditLog,
  type ContentStatus,
} from '../../db/schema';
import { ProviderRegistry } from './provider-registry.service';
import { ChecksService, type CheckResult, type AiDecision } from './checks.service';
import { buildFieldSchemaZod, factKeys } from './field-schema-builder';
import { getContentTypeConfig } from './content-types';
import { DraftRequestDto, ImproveRequestDto } from './dto/draft-request.dto';
import { ArticleScraperService, type ScrapedArticle } from './article-scraper.service';

// Sin límites de longitud aquí a propósito (a diferencia de una versión
// anterior que sí los tenía): un structured-output que no da en el clavo
// exacto de 120-160/60 caracteres a la primera hacía que claude-cli (que
// valida+reintenta contra este mismo schema) agotara sus reintentos y
// tronara con un 500 en vez de simplemente quedar "needs-review" — la
// longitud real SÍ se sigue exigiendo, pero como check post-generación en
// ChecksService (bloqueante para auto-publicar), no como restricción dura
// de generación. Mismo resultado de seguridad, sin el crash.
// Los límites reales (≤60 / 120-160) se exigen como CHECK bloqueante en
// ChecksService, no aquí — aquí solo se pone un tope holgado (evita que un
// output vacío o desbordado pase) para no repetir el crash que causaba la
// versión anterior (min/max exactos + reintentos agotados en claude-cli, que
// no tiene structured-output forzado como OpenAI). El `.describe()` sigue
// comunicando el objetivo real para que el modelo apunte ahí de todos modos.
const seoShape = {
  title: z.string().min(1).max(90).describe('Título SEO — máximo 60 caracteres (cuenta los caracteres, es un límite real de Google).'),
  description: z.string().min(60).max(220).describe('Meta descripción SEO — entre 120 y 160 caracteres (cuenta los caracteres).'),
};

export interface DraftResult {
  draft: Record<string, unknown>;
  checksRun: CheckResult[];
  decision: AiDecision;
}

// Orquesta el agente editorial: arma el schema dinámico (tipo de contenido +
// field_schema de la categoría), llama al provider de IA, corre los checks
// automáticos, y — solo cuando hay un contentId real (modo "improve") —
// registra la corrida en content_audit_log. Ver Fase 3 del plan.
@Injectable()
export class AiDraftService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDb,
    private readonly providers: ProviderRegistry,
    private readonly checks: ChecksService,
    private readonly scraper: ArticleScraperService,
  ) {}

  // La primera URL citada en `hints` (content-radar siempre la manda entre
  // paréntesis al final — ver injectPublishButtons/injectItemPublishButtons
  // en apps/content-radar/src/render.ts). Si el scraping falla (sitio caído,
  // paywall, formato inesperado) devuelve null — nunca bloquea el draft.
  private async scrapeSourceFromHints(hints?: string): Promise<ScrapedArticle | null> {
    const url = hints?.match(/https?:\/\/\S+/)?.[0]?.replace(/[).,]+$/, '');
    if (!url) return null;
    return this.scraper.scrape(url);
  }

  async draft(dto: DraftRequestDto): Promise<DraftResult> {
    const typeConfig = getContentTypeConfig(dto.contentType);
    const category = await this.db.query.categories.findFirst({ where: eq(categories.id, dto.categoryId) });
    if (!category) throw new BadRequestException(`Categoría "${dto.categoryId}" no existe`);

    const fieldSchema = buildFieldSchemaZod(category.fieldSchema);
    const fullSchema = z.object({ seo: z.object(seoShape), ...typeConfig.editorialShape, ...fieldSchema.shape });

    // Fase 2 del plan de rediseño del pipeline (content-radar → Centro IA):
    // en vez de que la IA solo vea el titular citado en `hints`, se lee el
    // artículo completo de esa fuente — más material real para redactar.
    const scrapedArticle = await this.scrapeSourceFromHints(dto.hints);

    const userPrompt = [
      `Tipo de contenido: ${typeConfig.label}`,
      `Categoría: ${category.name}`,
      `Nombre/título: ${dto.name}`,
      dto.hints ? `Notas del editor: ${dto.hints}` : 'Notas del editor: (ninguna)',
      scrapedArticle
        ? `\nArtículo completo de la fuente citada (leído en vivo, para que tengas más contexto que solo el titular):\n"""\n${scrapedArticle.text}\n"""`
        : '',
      '',
      'Genera también seo.title (≤60 caracteres) y seo.description (120-160 caracteres) para esta pieza.',
      category.fieldSchema.length
        ? `Completa también estos campos propios de la categoría cuando la información lo permita (deja null los que no puedas saber con certeza, especialmente los marcados como dato verificable): ${category.fieldSchema.map((f) => `${f.key} (${f.label})`).join(', ')}.`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const output = await this.providers.get(dto.provider).generateStructured({
      systemPrompt: typeConfig.systemPrompt,
      userPrompt,
      schema: fullSchema,
      schemaName: `${dto.contentType}_draft`,
    });

    const { checksRun, decision } = this.checks.run({
      mode: 'draft',
      requiredFields: [...typeConfig.requiredEditorialFields, ...category.fieldSchema.filter((f) => f.required).map((f) => f.key)],
      factFields: factKeys(category.fieldSchema),
      draftData: output as Record<string, unknown>,
      seo: (output as { seo?: { title?: string; description?: string } }).seo,
      hasImageWithAlt: undefined, // no hay imagen todavía en un borrador nuevo — no bloquea el preview
      slugAvailable: undefined, // se resuelve al guardar, no en el preview
      bodyText: JSON.stringify(output),
    });

    return { draft: output as Record<string, unknown>, checksRun, decision };
  }

  /** Solo implementado para 'place' por ahora — es el único tipo con carga/guardado
   * real ya construido (Fase 2). El resto sigue el mismo patrón una vez tengan su CRUD. */
  async improvePlace(id: string, dto: ImproveRequestDto, actorId?: string): Promise<DraftResult> {
    const existing = await this.db.query.places.findFirst({
      where: eq(places.id, id),
      with: { placeCategories: { with: { category: true } }, photos: true },
    });
    if (!existing) throw new NotFoundException(`Place "${id}" no existe`);

    const category = existing.placeCategories[0]?.category;
    const typeConfig = getContentTypeConfig('place');
    // A propósito SIN fieldSchema.shape aquí (a diferencia de draft()): "Mejorar"
    // nunca debe poder escribir campos de categoría — ni siquiera con instrucciones
    // explícitas de no inventar, el modelo (sobre todo vía claude-cli, sin
    // structured-output forzado) tiende a "llenar" cualquier campo que el schema
    // le ofrezca. Quitarlo del schema hace la protección estructural, no solo de
    // prompt — ver Fase 6.5 del plan, donde esto se detectó en la práctica.
    const fullSchema = z.object({ seo: z.object(seoShape), ...typeConfig.editorialShape });

    const originalFacts: Record<string, unknown> = { ...existing.categoryData };

    const userPrompt = [
      `Tipo de contenido: ${typeConfig.label}`,
      `Nombre: ${existing.name}`,
      `Descripción actual: ${existing.description ?? '(vacía — redáctala desde cero con lo que sabes del nombre)'}`,
      `Categoría: ${category?.name ?? '(sin categoría)'}`,
      dto.instructions ? `Instrucción del editor: ${dto.instructions}` : '',
      '',
      'Tu trabajo es MEJORAR la redacción y el SEO. No te pido ningún dato de la categoría (dirección, precio, horario, etc.) — esos ya están capturados aparte y no forman parte de tu respuesta.',
      Object.keys(originalFacts).length
        ? `Para contexto, así están hoy los datos verificables de este lugar (no forman parte de tu respuesta, son solo referencia): ${JSON.stringify(originalFacts)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const improveSystemPrompt = `${typeConfig.systemPrompt}\n\nEstás MEJORANDO contenido existente, no creando desde cero: expande texto genérico/ambiguo. Tu respuesta solo lleva los campos editoriales (descripción, SEO) que te pide el schema — nunca dirección, teléfono, precios, horarios ni ningún otro dato verificable.`;

    const output = await this.providers.get(dto.provider).generateStructured({
      systemPrompt: improveSystemPrompt,
      userPrompt,
      schema: fullSchema,
      schemaName: 'place_improve',
    });

    const { checksRun, decision } = this.checks.run({
      mode: 'improve',
      requiredFields: [...typeConfig.requiredEditorialFields],
      factFields: category ? factKeys(category.fieldSchema) : [],
      draftData: output as Record<string, unknown>,
      originalFacts,
      seo: (output as { seo?: { title?: string; description?: string } }).seo,
      hasImageWithAlt: existing.photos.some((p) => !!p.alt),
      slugAvailable: true, // el slug no cambia en "improve"
      bodyText: JSON.stringify(output),
    });

    const planazoSite = await this.db.query.sites.findFirst({ where: eq(sites.slug, 'planazo') });

    await this.db.insert(contentAuditLog).values({
      siteId: planazoSite!.id,
      contentType: 'place',
      contentId: id,
      categoryId: category?.id,
      mode: 'improve',
      sourceContext: { instructions: dto.instructions ?? null },
      inputFacts: originalFacts,
      aiModel: dto.provider === 'claude-cli' ? 'claude-cli' : 'gpt-4o-mini',
      aiOutput: output as Record<string, unknown>,
      checksRun,
      decision,
      statusBefore: existing.status,
      statusAfter: decision === 'auto-published' ? 'published' : 'in_review',
      actorId: actorId ?? null,
    });

    return { draft: output as Record<string, unknown>, checksRun, decision };
  }

  /** Los 6 tipos de la-mira con CRUD real (Fase 2) — 'place' sigue por separado
   * arriba porque su categoría es una relación N:M (placeCategories), no una
   * columna categoryId directa como en estos. `queryKey` es el nombre que usa
   * `db.query.<queryKey>` (Drizzle no permite indexar `db.query` por la tabla
   * misma, solo por su nombre de export). */
  private lamiraTableInfo(type: string): { table: typeof noticias; queryKey: 'noticias' | 'alertas' | 'guias' | 'lamiraEventos' | 'lamiraLugares' | 'reportajes' } {
    switch (type) {
      case 'noticia':
        return { table: noticias, queryKey: 'noticias' };
      case 'alerta':
        return { table: alertas as never, queryKey: 'alertas' };
      case 'guia':
        return { table: guias as never, queryKey: 'guias' };
      case 'evento':
        return { table: lamiraEventos as never, queryKey: 'lamiraEventos' };
      case 'lugar':
        return { table: lamiraLugares as never, queryKey: 'lamiraLugares' };
      case 'reportaje':
        return { table: reportajes as never, queryKey: 'reportajes' };
      default:
        throw new BadRequestException(`"Mejorar" no está implementado para el tipo "${type}".`);
    }
  }

  /** "Título" legible del row para el prompt — cada tipo de la-mira usa un
   * nombre de campo distinto (title vs. name), igual que el original. */
  private lamiraTitle(type: string, row: Record<string, unknown>): string {
    return type === 'lugar' ? (row.name as string) : (row.title as string);
  }

  /** Texto actual a mejorar, por tipo — solo lo editorial (nunca fecha/hora/
   * precio/ubicación/updates, que son datos verificables capturados aparte
   * y ni siquiera entran al schema que ve la IA). */
  private lamiraCurrentText(type: string, row: Record<string, unknown>): string {
    switch (type) {
      case 'noticia':
      case 'reportaje':
        return JSON.stringify({ dek: row.dek, content: row.content });
      case 'guia':
        return JSON.stringify({ dek: row.dek, content: row.content, faq: row.faq });
      case 'alerta':
      case 'evento':
      case 'lugar':
        return (row.description as string) ?? '(vacía — redáctala desde cero con lo que sabes del título)';
      default:
        return '';
    }
  }

  /** Enruta improve/:type/:id al método correcto — 'place' ya tenía su propia
   * implementación probada (Fase 3); los 6 tipos de la-mira comparten una
   * sola implementación genérica porque su forma (categoryId directo,
   * categoryData jsonb, seo jsonb) ya es idéntica entre sí. */
  async improveContent(type: string, id: string, dto: ImproveRequestDto, actorId?: string): Promise<DraftResult> {
    if (type === 'place') return this.improvePlace(id, dto, actorId);
    return this.improveLamiraContent(type, id, dto, actorId);
  }

  private async improveLamiraContent(type: string, id: string, dto: ImproveRequestDto, actorId?: string): Promise<DraftResult> {
    const { table, queryKey } = this.lamiraTableInfo(type);
    const existing = await (this.db.query[queryKey] as never as (typeof this.db.query)['noticias']).findFirst({
      where: eq(table.id, id),
      with: { category: true },
    });
    if (!existing) throw new NotFoundException(`"${type}" "${id}" no existe`);

    const typeConfig = getContentTypeConfig(type);
    const category = (existing as { category: { id: string; name: string; fieldSchema: import('@planazo/types').FieldSchemaEntry[] } | null }).category;
    // A propósito SIN fieldSchema.shape aquí (a diferencia de draft()) — ver el
    // mismo comentario en improvePlace más arriba: protección estructural, no
    // solo de prompt, contra que el modelo "invente" campos de categoría.
    const fullSchema = z.object({ seo: z.object(seoShape), ...typeConfig.editorialShape });

    const row = existing as unknown as Record<string, unknown>;
    const originalFacts: Record<string, unknown> = { ...(row.categoryData as Record<string, unknown>) };

    const userPrompt = [
      `Tipo de contenido: ${typeConfig.label}`,
      `Título/nombre: ${this.lamiraTitle(type, row)}`,
      `Contenido actual: ${this.lamiraCurrentText(type, row)}`,
      `Categoría: ${category?.name ?? '(sin categoría)'}`,
      dto.instructions ? `Instrucción del editor: ${dto.instructions}` : '',
      '',
      'Tu trabajo es MEJORAR la redacción y el SEO. No te pido ningún campo de categoría (datos verificables como línea, zona afectada, hora de inicio, etc.) — esos ya están capturados aparte y no forman parte de tu respuesta.',
      Object.keys(originalFacts).length
        ? `Para contexto, así están hoy los datos verificables de esta pieza (no forman parte de tu respuesta, son solo referencia): ${JSON.stringify(originalFacts)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const improveSystemPrompt = `${typeConfig.systemPrompt}\n\nEstás MEJORANDO contenido existente, no creando desde cero: expande texto genérico/ambiguo. Tu respuesta solo lleva los campos editoriales que te pide el schema — nunca cifras, fechas, ubicaciones ni ningún otro dato verificable.`;

    const output = await this.providers.get(dto.provider).generateStructured({
      systemPrompt: improveSystemPrompt,
      userPrompt,
      schema: fullSchema,
      schemaName: `${type}_improve`,
    });

    const { checksRun, decision } = this.checks.run({
      mode: 'improve',
      requiredFields: [...typeConfig.requiredEditorialFields],
      factFields: category ? factKeys(category.fieldSchema) : [],
      draftData: output as Record<string, unknown>,
      originalFacts,
      seo: (output as { seo?: { title?: string; description?: string } }).seo,
      // la-mira no modela fotos con alt todavía (a diferencia de Place) — no hay
      // nada que chequear, no bloquea.
      hasImageWithAlt: undefined,
      slugAvailable: true, // el slug no cambia en "improve"
      bodyText: JSON.stringify(output),
    });

    const site = await this.db.query.sites.findFirst({ where: eq(sites.slug, 'la-mira') });
    // noticia/guia/reportaje tienen `status` (ContentStatus real, igual que Place);
    // alerta/evento/lugar no tienen ese concepto — el contenido migrado en Fase 6
    // ya está publicado en el sitio, así que se registra como tal.
    const statusValue = (typeof row.status === 'string' ? row.status : 'published') as ContentStatus;

    await this.db.insert(contentAuditLog).values({
      siteId: site!.id,
      contentType: type,
      contentId: id,
      categoryId: category?.id,
      mode: 'improve',
      sourceContext: { instructions: dto.instructions ?? null },
      inputFacts: originalFacts,
      aiModel: dto.provider === 'claude-cli' ? 'claude-cli' : 'gpt-4o-mini',
      aiOutput: output as Record<string, unknown>,
      checksRun,
      decision,
      // Esta pasada (Fase 6.5) solo mejora texto, nunca cambia el status editorial.
      statusBefore: statusValue,
      statusAfter: statusValue,
      actorId: actorId ?? null,
    });

    return { draft: output as Record<string, unknown>, checksRun, decision };
  }
}
