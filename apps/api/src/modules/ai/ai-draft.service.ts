import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { categories, sites, places, contentAuditLog } from '../../db/schema';
import { CONTENT_PROVIDER, type ContentProvider } from './content-provider.interface';
import { OPENAI_MODEL } from './providers/openai-provider';
import { ChecksService, type CheckResult, type AiDecision } from './checks.service';
import { buildFieldSchemaZod, factKeys } from './field-schema-builder';
import { getContentTypeConfig } from './content-types';
import { DraftRequestDto, ImproveRequestDto } from './dto/draft-request.dto';

const seoShape = { title: z.string().max(60), description: z.string().min(120).max(160) };

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
    @Inject(CONTENT_PROVIDER) private readonly provider: ContentProvider,
    private readonly checks: ChecksService,
  ) {}

  async draft(dto: DraftRequestDto): Promise<DraftResult> {
    const typeConfig = getContentTypeConfig(dto.contentType);
    const category = await this.db.query.categories.findFirst({ where: eq(categories.id, dto.categoryId) });
    if (!category) throw new BadRequestException(`Categoría "${dto.categoryId}" no existe`);

    const fieldSchema = buildFieldSchemaZod(category.fieldSchema);
    const fullSchema = z.object({ seo: z.object(seoShape), ...typeConfig.editorialShape, ...fieldSchema.shape });

    const userPrompt = [
      `Tipo de contenido: ${typeConfig.label}`,
      `Categoría: ${category.name}`,
      `Nombre/título: ${dto.name}`,
      dto.hints ? `Notas del editor: ${dto.hints}` : 'Notas del editor: (ninguna)',
      '',
      'Genera también seo.title (≤60 caracteres) y seo.description (120-160 caracteres) para esta pieza.',
      category.fieldSchema.length
        ? `Completa también estos campos propios de la categoría cuando la información lo permita (deja null los que no puedas saber con certeza, especialmente los marcados como dato verificable): ${category.fieldSchema.map((f) => `${f.key} (${f.label})`).join(', ')}.`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const output = await this.provider.generateStructured({
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
    const fieldSchema = category ? buildFieldSchemaZod(category.fieldSchema) : z.object({});
    const fullSchema = z.object({ seo: z.object(seoShape), ...typeConfig.editorialShape, ...fieldSchema.shape });

    const originalFacts: Record<string, unknown> = { ...existing.categoryData };

    const userPrompt = [
      `Tipo de contenido: ${typeConfig.label}`,
      `Nombre: ${existing.name}`,
      `Descripción actual: ${existing.description ?? '(vacía — redáctala desde cero con lo que sabes del nombre)'}`,
      `Categoría: ${category?.name ?? '(sin categoría)'}`,
      dto.instructions ? `Instrucción del editor: ${dto.instructions}` : '',
      '',
      'Tu trabajo es MEJORAR la redacción y el SEO — no inventar ni cambiar ningún dato verificable. Los campos marcados como dato verificable deben quedar exactamente igual salvo que el editor te haya dado un reemplazo explícito arriba.',
      Object.keys(originalFacts).length
        ? `Valores actuales de campos-hecho (no los cambies): ${JSON.stringify(originalFacts)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const improveSystemPrompt = `${typeConfig.systemPrompt}\n\nEstás MEJORANDO contenido existente, no creando desde cero: expande texto genérico/ambiguo, pero cada campo marcado como dato verificable debe salir idéntico al valor original salvo instrucción explícita del editor.`;

    const output = await this.provider.generateStructured({
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
      aiModel: OPENAI_MODEL,
      aiOutput: output as Record<string, unknown>,
      checksRun,
      decision,
      statusBefore: existing.status,
      statusAfter: decision === 'auto-published' ? 'published' : 'in_review',
      actorId: actorId ?? null,
    });

    return { draft: output as Record<string, unknown>, checksRun, decision };
  }
}
