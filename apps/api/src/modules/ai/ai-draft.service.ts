import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import {
  categories,
  sites,
  places,
  events,
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
import {
  ChecksService,
  type CheckResult,
  type AiDecision,
} from './checks.service';
import { buildFieldSchemaZod, factKeys } from './field-schema-builder';
import { CONTENT_TYPES, getContentTypeConfig } from './content-types';
import {
  DraftRequestDto,
  ImproveRequestDto,
  DraftExpandRequestDto,
} from './dto/draft-request.dto';
import { slugify } from '@planazo/shared';
import {
  ArticleScraperService,
  type ScrapedArticle,
} from './article-scraper.service';
import { ImageSearchService } from './image-search.service';
import { CategoriesService } from '../categories/categories.service';
import type { ContentBlock } from '@planazo/types';

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
  title: z
    .string()
    .min(1)
    .max(90)
    .describe(
      'Título SEO — máximo 60 caracteres (cuenta los caracteres, es un límite real de Google). Atractivo para clic, con su propio ángulo — no una copia tal cual del tema/semilla ni del encabezado editorial.',
    ),
  description: z
    .string()
    .min(60)
    .max(220)
    .describe(
      'Meta descripción SEO — entre 120 y 160 caracteres (cuenta los caracteres). Atractiva y concreta, sin repetir el título palabra por palabra.',
    ),
};

export interface DraftResult {
  draft: Record<string, unknown>;
  checksRun: CheckResult[];
  decision: AiDecision;
  // Fase 4 del plan: imagen de la fuente original (og:image), con crédito —
  // viene del scraping (ArticleScraperService). Si no hay ninguna, se busca
  // una automáticamente (Wikimedia/Openverse) con `imageSearchQuery` — nunca
  // la genera/inventa la IA, siempre viene de una fuente real. El humano
  // puede quitarla/reemplazarla en la revisión de todos modos.
  image: { url: string; credit: string } | null;
  // Otras imágenes reales del mismo artículo scrapeado (además de la
  // principal) — candidatas extra para usar en algún bloque de contenido.
  articleImages: { url: string; credit: string }[];
  // Palabras clave que la IA generó para buscar una imagen libre — el CMS
  // las usa como query por default en el picker de búsqueda.
  imageSearchQuery: string;
  // La categoría con la que se generó el draft — si el caller no mandó
  // categoryId, es la que la IA clasificó sola (ver classifyCategory). El
  // CMS la usa para dejarla preseleccionada, editable, en la revisión.
  categoryId: string;
  // Sitio + tipo con los que se generó — si el caller no mandó site/contentType
  // (flujo de Publicar desde content-radar), son los que la IA clasificó sola
  // (ver classifyContentType). El CMS los usa para saber qué formulario mostrar.
  site: 'la-mira' | 'planazo';
  contentType: string;
  // URL del artículo original citado en `hints` (Milenio, Reforma, etc.) —
  // null si no había una fuente citada (ej. un tema tecleado a mano sin
  // hints, o hints sin URL). El CMS la usa para el campo "URL de la fuente"
  // en noticia/reportaje, editable después.
  sourceUrl: string | null;
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
    private readonly categoriesService: CategoriesService,
    private readonly imageSearch: ImageSearchService,
  ) {}

  // La primera URL citada en `hints` (content-radar siempre la manda entre
  // paréntesis al final — ver injectPublishButtons/injectItemPublishButtons
  // en apps/content-radar/src/render.ts). Si el scraping falla (sitio caído,
  // paywall, formato inesperado) devuelve null — nunca bloquea el draft.
  private urlFromHints(hints?: string): string | null {
    return hints?.match(/https?:\/\/\S+/)?.[0]?.replace(/[).,]+$/, '') || null;
  }

  private async scrapeSourceFromHints(
    hints?: string,
  ): Promise<ScrapedArticle | null> {
    const url = this.urlFromHints(hints);
    if (!url) return null;
    return this.scraper.scrape(url);
  }

  // Nombre de la fuente ("MILENIO", "La Jornada"...) tal como content-radar ya
  // lo escribe en `hints`, justo antes de la URL entre paréntesis — mismo
  // formato en injectPublishButtons e injectItemPublishButtons. Se usa para
  // el crédito de la imagen ("Foto: MILENIO"), no para el prompt de la IA.
  private sourceLabelFromHints(hints?: string): string | null {
    const match = hints?.match(/—\s*([^()]+?)\s*\(https?:\/\//);
    return match?.[1]?.trim() || null;
  }

  // El editor ya no elige la categoría a mano por default (arrancaba siempre
  // en la primera de la lista del sitio, casi nunca la correcta) — la IA la
  // clasifica sola, con el mismo material (tema + artículo completo) que va
  // a usar para redactar. Sigue siendo 100% editable después: dto.categoryId
  // es opcional justo para permitir que el humano la fuerce si hace falta.
  // `site` va aparte (no como dto.site) porque para cuando se llama aquí ya
  // está resuelto — provisto por el caller o recién clasificado por
  // classifyContentType — y dto.site puede seguir siendo opcional en el tipo.
  private async classifyCategory(
    site: 'la-mira' | 'planazo',
    dto: DraftRequestDto,
    scrapedArticle: ScrapedArticle | null,
  ): Promise<string> {
    const siteCategories = await this.categoriesService.findAll(site);
    if (siteCategories.length === 0) {
      throw new BadRequestException(
        `El sitio "${site}" no tiene categorías configuradas.`,
      );
    }

    const categoryIds = siteCategories.map((c) => c.id) as [
      string,
      ...string[],
    ];
    const classifySchema = z.object({
      categoryId: z
        .enum(categoryIds)
        .describe(
          'El id de la categoría que mejor encaja — debe ser exactamente uno de los ids de la lista.',
        ),
    });

    const material = [
      `Tema/título: ${dto.name}`,
      dto.hints ? `Notas del editor: ${dto.hints}` : '',
      scrapedArticle
        ? `Artículo completo de la fuente citada:\n"""\n${scrapedArticle.text}\n"""`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const categoryList = siteCategories
      .map((c) => `- ${c.id}: ${c.name}`)
      .join('\n');
    const siteLabel =
      site === 'la-mira'
        ? 'La Mira, un periódico digital hiperlocal de la Ciudad de México'
        : 'Planazo, una guía de planes y lugares de la Ciudad de México';

    const output = await this.providers.get(dto.provider).generateStructured({
      systemPrompt: `Eres un editor que clasifica contenido para ${siteLabel}. Tu único trabajo es elegir, de la lista de categorías reales que te doy, la que mejor encaja con el tema — nunca inventes una categoría que no esté en la lista.`,
      userPrompt: `${material}\n\nCategorías disponibles (responde con el id de exactamente una de ellas):\n${categoryList}`,
      schema: classifySchema,
      schemaName: 'category_classification',
    });

    return output.categoryId;
  }

  // Cuando el humano llega desde el botón Publicar de content-radar, ya no
  // trae `site`/`contentType` fijos (antes se forzaba todo a La Mira, aunque
  // el tema encajara mejor en Planazo — ej. un evento real). Se clasifican
  // los dos JUNTOS en un solo paso, sobre el registro completo de tipos
  // (CONTENT_TYPES, ambos sitios) — el `site` de un tipo se deriva de cuál
  // ganó, no se pregunta aparte, porque razonar directo sobre "¿qué tipo de
  // pieza es esto?" es más concreto para el modelo que un "¿qué sitio?"
  // abstracto primero.
  private async classifyContentType(
    dto: DraftRequestDto,
    scrapedArticle: ScrapedArticle | null,
  ): Promise<{ site: 'la-mira' | 'planazo'; contentType: string }> {
    const entries = Object.values(CONTENT_TYPES);
    const keys = entries.map((e) => e.contentType) as [string, ...string[]];
    const classifySchema = z.object({
      contentType: z
        .enum(keys)
        .describe(
          'El tipo de contenido que mejor encaja — debe ser exactamente uno de los ids de la lista.',
        ),
    });

    const material = [
      `Tema/título: ${dto.name}`,
      dto.hints ? `Notas del editor: ${dto.hints}` : '',
      scrapedArticle
        ? `Artículo completo de la fuente citada:\n"""\n${scrapedArticle.text}\n"""`
        : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    const typeList = entries
      .map(
        (e) =>
          `- ${e.contentType} (${e.site === 'la-mira' ? 'La Mira' : 'Planazo'} — ${e.label}): ${e.classifyHint}`,
      )
      .join('\n');

    const output = await this.providers.get(dto.provider).generateStructured({
      systemPrompt:
        'Eres un editor que decide en qué sitio y bajo qué tipo de contenido publicar un tema, entre dos publicaciones digitales de la Ciudad de México: La Mira (periodismo hiperlocal — noticias, alertas, guías, eventos y lugares con angle noticioso) y Planazo (directorio evergreen de planes — lugares y eventos recomendados, sin angle de cobertura). Elige el tipo que mejor encaja — nunca inventes uno que no esté en la lista.',
      userPrompt: `${material}\n\nTipos disponibles (responde con el id de exactamente uno de ellos):\n${typeList}`,
      schema: classifySchema,
      schemaName: 'content_type_classification',
    });

    const contentType = output.contentType;
    return { site: getContentTypeConfig(contentType).site, contentType };
  }

  async draft(dto: DraftRequestDto): Promise<DraftResult> {
    // Fase 2 del plan de rediseño del pipeline (content-radar → Centro IA):
    // en vez de que la IA solo vea el titular citado en `hints`, se lee el
    // artículo completo de esa fuente — más material real, tanto para
    // clasificar sitio/tipo/categoría como para redactar.
    const scrapedArticle = await this.scrapeSourceFromHints(dto.hints);

    let site = dto.site;
    let contentType = dto.contentType;
    if (!site || !contentType) {
      ({ site, contentType } = await this.classifyContentType(
        dto,
        scrapedArticle,
      ));
    }

    const typeConfig = getContentTypeConfig(contentType);
    const categoryId =
      dto.categoryId ??
      (await this.classifyCategory(site, dto, scrapedArticle));
    const category = await this.db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
    });
    if (!category)
      throw new BadRequestException(`Categoría "${categoryId}" no existe`);

    const fieldSchema = buildFieldSchemaZod(category.fieldSchema);
    const fullSchema = z.object({
      seo: z.object(seoShape),
      ...typeConfig.editorialShape,
      ...fieldSchema.shape,
    });

    // Los tipos "de nota" (noticia/alerta/guia/evento/reportaje) llevan su
    // propio campo `title` en editorialShape (ver titleShape en content-types.ts)
    // — ahí dto.name es solo el tema/semilla que dispara la generación, NUNCA
    // el encabezado final. `place`/`evento-planazo`/`lugar` no lo llevan: ahí
    // dto.name SÍ es el nombre propio real (un lugar, un negocio) y se usa tal
    // cual, no se reescribe.
    const hasOwnTitle = 'title' in typeConfig.editorialShape;
    const userPrompt = [
      `Tipo de contenido: ${typeConfig.label}`,
      `Categoría: ${category.name}`,
      hasOwnTitle
        ? `Tema/semilla (NO es el título final — tú escribes tu propio encabezado en el campo "title"): ${dto.name}`
        : `Nombre: ${dto.name}`,
      dto.hints
        ? `Notas del editor: ${dto.hints}`
        : 'Notas del editor: (ninguna)',
      // Fase 3 del plan: el artículo completo va marcado explícitamente como
      // "material de referencia" — es insumo factual, NO una fuente para
      // copiar/parafrasear. La regla completa vive en LAMIRA_BASE_PROMPT
      // (content-types.ts); se repite aquí, junto al texto mismo, porque un
      // recordatorio pegado al contenido real se respeta más que uno lejano.
      scrapedArticle
        ? `\nMaterial de referencia — artículo completo de la fuente citada, leído en vivo. SOLO para informarte de los hechos: no lo copies, no lo parafrasees de cerca, no repitas su estructura. Redacta tu propia nota, con tus propias palabras:\n"""\n${scrapedArticle.text}\n"""`
        : '',
      '',
      hasOwnTitle
        ? 'Escribe tu propio "title" (encabezado editorial) — atractivo, distinto del tema/semilla de arriba, nunca una copia tal cual de un titular ajeno.'
        : '',
      'Genera también seo.title (≤60 caracteres) y seo.description (120-160 caracteres) para esta pieza — con su propio ángulo, no una repetición del encabezado.',
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
      schemaName: `${contentType}_draft`,
    });

    const { checksRun, decision } = this.checks.run({
      mode: 'draft',
      requiredFields: [
        ...typeConfig.requiredEditorialFields,
        ...category.fieldSchema.filter((f) => f.required).map((f) => f.key),
      ],
      factFields: factKeys(category.fieldSchema),
      draftData: output,
      seo: (output as { seo?: { title?: string; description?: string } }).seo,
      hasImageWithAlt: undefined, // no hay imagen todavía en un borrador nuevo — no bloquea el preview
      slugAvailable: undefined, // se resuelve al guardar, no en el preview
      bodyText: JSON.stringify(output),
    });

    // Fase 4 del plan: imagen de la fuente citada, con crédito — determinística
    // (viene del og:image real que ya trajo el scraping), nunca la decide la IA.
    const sourceLabel = this.sourceLabelFromHints(dto.hints);
    const scrapedImage =
      scrapedArticle?.imageUrl && sourceLabel
        ? { url: scrapedArticle.imageUrl, credit: `Foto: ${sourceLabel}` }
        : null;
    const articleImages =
      sourceLabel && scrapedArticle?.additionalImageUrls.length
        ? scrapedArticle.additionalImageUrls.map((url) => ({
            url,
            credit: `Foto: ${sourceLabel}`,
          }))
        : [];

    const imageSearchQuery =
      (output as { imageSearchQuery?: string }).imageSearchQuery ?? '';
    // Si no hay imagen de la fuente citada (scraping falló o no citó fuente),
    // se busca una automáticamente con las palabras clave que la IA generó —
    // así el humano ya ve algo puesto en la revisión, sin tener que buscar a
    // mano. Sigue siendo 100% reemplazable/quitable después.
    let image = scrapedImage;
    if (!image && imageSearchQuery) {
      const results = await this.imageSearch.search(imageSearchQuery);
      if (results[0])
        image = { url: results[0].url, credit: results[0].credit };
    }

    return {
      draft: output,
      checksRun,
      decision,
      image,
      articleImages,
      imageSearchQuery,
      categoryId: category.id,
      site,
      contentType,
      sourceUrl: this.urlFromHints(dto.hints),
    };
  }

  /** Solo implementado para 'place' por ahora — es el único tipo con carga/guardado
   * real ya construido (Fase 2). El resto sigue el mismo patrón una vez tengan su CRUD. */
  async improvePlace(
    id: string,
    dto: ImproveRequestDto,
    actorId?: string,
  ): Promise<DraftResult> {
    const existing = await this.db.query.places.findFirst({
      where: eq(places.id, id),
      with: { placeCategories: { with: { category: true } }, photos: true },
    });
    if (!existing) throw new NotFoundException(`Place "${id}" no existe`);

    if (dto.mode === 'expand') {
      return this.expandPlaceContent(existing, dto, actorId);
    }

    const category = existing.placeCategories[0]?.category;
    const typeConfig = getContentTypeConfig('place');
    // A propósito SIN fieldSchema.shape aquí (a diferencia de draft()): "Mejorar"
    // nunca debe poder escribir campos de categoría — ni siquiera con instrucciones
    // explícitas de no inventar, el modelo (sobre todo vía claude-cli, sin
    // structured-output forzado) tiende a "llenar" cualquier campo que el schema
    // le ofrezca. Quitarlo del schema hace la protección estructural, no solo de
    // prompt — ver Fase 6.5 del plan, donde esto se detectó en la práctica.
    const fullSchema = z.object({
      seo: z.object(seoShape),
      ...typeConfig.editorialShape,
    });

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
      draftData: output,
      originalFacts,
      seo: (output as { seo?: { title?: string; description?: string } }).seo,
      hasImageWithAlt: existing.photos.some((p) => !!p.alt),
      slugAvailable: true, // el slug no cambia en "improve"
      bodyText: JSON.stringify(output),
    });

    const planazoSite = await this.db.query.sites.findFirst({
      where: eq(sites.slug, 'planazo'),
    });

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

    // "Mejorar" edita contenido ya existente — no toca la imagen (eso vive
    // aparte, en el registro que ya se creó); Fase 4 solo cubre el draft nuevo.
    return {
      draft: output,
      checksRun,
      decision,
      image: null,
      articleImages: [],
      imageSearchQuery: '',
      sourceUrl: null,
      categoryId: category?.id ?? '',
      site: 'planazo',
      contentType: 'place',
    };
  }

  /** Núcleo compartido de "Agregar contenido" (dto.mode === 'expand') para
   * los 8 tipos — escribe 1-3 secciones NUEVAS de cuerpo (heading+paragraphs)
   * en vez de reescribir descripción/SEO, nunca inventa datos verificables
   * (el schema ni siquiera los ofrece). Cada caller (place/evento-planazo/
   * los 6 de la-mira/pre-creación en Centro IA) le da su propio texto de
   * contexto y arma el merge + la auditoría (si aplica) por su cuenta. */
  private async generateExpandSections(params: {
    typeConfig: (typeof CONTENT_TYPES)[keyof typeof CONTENT_TYPES];
    subjectLine: string; // ej. "Lugar: Café Roma" / "Noticia: Reabre el Bosque de Chapultepec"
    categoryName: string | null;
    currentSummary: string;
    existingHeadings: string[];
    instructions?: string;
    provider: ImproveRequestDto['provider'];
  }): Promise<{ newBlocks: ContentBlock[]; checksRun: CheckResult[]; decision: AiDecision }> {
    const expandSchema = z.object({
      content: z
        .array(
          z.object({
            heading: z
              .string()
              .describe('Encabezado corto de la sección (3-6 palabras).'),
            paragraphs: z
              .array(z.string())
              .min(2)
              .max(4)
              .describe('2-4 párrafos de la sección, en español de México.'),
          }),
        )
        .min(1)
        .max(3)
        .describe('1-3 secciones NUEVAS — nunca repitas temas ya cubiertos.'),
    });

    const userPrompt = [
      params.subjectLine,
      `Categoría: ${params.categoryName ?? '(sin categoría)'}`,
      `Contenido actual (resumen, no lo repitas): ${params.currentSummary}`,
      params.existingHeadings.length
        ? `Secciones que YA existen (no repitas estos temas): ${params.existingHeadings.join(', ')}`
        : '',
      params.instructions ? `Instrucción del editor: ${params.instructions}` : '',
      '',
      'Escribe 1-3 secciones NUEVAS de contenido para ampliar esta pieza con información general útil para el lector (contexto, detalles, tips, para quién es bueno, qué esperar) — nunca inventes datos verificables específicos (dirección, precios, horarios, teléfono, cifras, nombres, citas) que no te dieron.',
    ]
      .filter(Boolean)
      .join('\n');

    const output = (await this.providers.get(params.provider).generateStructured({
      systemPrompt: `${params.typeConfig.systemPrompt}\n\nEstás AGREGANDO contenido nuevo a una pieza existente, no reescribiendo lo que ya hay.`,
      userPrompt,
      schema: expandSchema,
      schemaName: `${params.typeConfig.contentType}_expand`,
    })) as { content: { heading: string; paragraphs: string[] }[] };

    const newBlocks: ContentBlock[] = output.content.map((b) => ({
      heading: b.heading,
      paragraphs: b.paragraphs,
      image: null,
    }));

    const checksRun: CheckResult[] = [
      {
        name: 'Secciones nuevas generadas',
        passed: newBlocks.length > 0,
        blocking: true,
        detail: `${newBlocks.length} sección(es) nueva(s)`,
      },
    ];
    const decision: AiDecision = 'needs-review'; // siempre requiere revisión humana antes de aplicar

    return { newBlocks, checksRun, decision };
  }

  /** Agrega un `id` (slug del heading, deduplicado) a cada bloque nuevo —
   * solo 'guia' lo requiere en su columna `content` (a diferencia de los
   * demás tipos, que usan el ContentBlock genérico sin id). */
  private withGuiaBlockIds(
    blocks: ContentBlock[],
    existing: { id: string; heading: string }[],
  ): { id: string; heading: string; paragraphs: string[]; image?: { url: string; credit: string } | null }[] {
    const seen = new Map<string, number>(existing.map((b) => [b.id, 1]));
    return blocks.map((b) => {
      const base = slugify(b.heading ?? '') || 'seccion';
      let candidate = base;
      let n = seen.get(base) ?? 0;
      while (seen.has(candidate)) {
        n += 1;
        candidate = `${base}-${n}`;
      }
      seen.set(candidate, 1);
      return { id: candidate, heading: b.heading ?? '', paragraphs: b.paragraphs, image: b.image };
    });
  }

  /** "Agregar contenido" para 'place' (post-creación, ya guardado en BD). */
  private async expandPlaceContent(
    existing: {
      id: string;
      name: string;
      description: string | null;
      content: ContentBlock[];
      status: ContentStatus;
      categoryData: Record<string, unknown>;
      placeCategories: Array<{ category: { id: string; name: string } | null }>;
    },
    dto: ImproveRequestDto,
    actorId?: string,
  ): Promise<DraftResult> {
    const category = existing.placeCategories[0]?.category;
    const existingHeadings = existing.content
      .map((b) => b.heading)
      .filter((h): h is string => !!h);

    const { newBlocks, checksRun, decision } = await this.generateExpandSections({
      typeConfig: getContentTypeConfig('place'),
      subjectLine: `Lugar: ${existing.name}`,
      categoryName: category?.name ?? null,
      currentSummary: existing.description ?? '(vacía)',
      existingHeadings,
      instructions: dto.instructions,
      provider: dto.provider,
    });
    const mergedContent = [...existing.content, ...newBlocks];

    const planazoSite = await this.db.query.sites.findFirst({
      where: eq(sites.slug, 'planazo'),
    });

    await this.db.insert(contentAuditLog).values({
      siteId: planazoSite!.id,
      contentType: 'place',
      contentId: existing.id,
      categoryId: category?.id,
      mode: 'expand',
      sourceContext: { instructions: dto.instructions ?? null },
      inputFacts: { existingHeadings },
      aiModel: dto.provider === 'claude-cli' ? 'claude-cli' : 'gpt-4o-mini',
      aiOutput: { content: newBlocks } as Record<string, unknown>,
      checksRun,
      decision,
      statusBefore: existing.status,
      statusAfter: existing.status,
      actorId: actorId ?? null,
    });

    return {
      draft: { content: mergedContent },
      checksRun,
      decision,
      image: null,
      articleImages: [],
      imageSearchQuery: '',
      sourceUrl: null,
      categoryId: '',
      site: 'planazo',
      contentType: 'place',
    };
  }

  /** "Agregar contenido" para evento-planazo (post-creación). */
  private async expandPlanazoEvento(
    id: string,
    dto: ImproveRequestDto,
    actorId?: string,
  ): Promise<DraftResult> {
    const existing = await this.db.query.events.findFirst({
      where: eq(events.id, id),
      with: { category: true },
    });
    if (!existing) throw new NotFoundException(`Evento "${id}" no existe`);

    const category = existing.category;
    const existingHeadings = (existing.content as ContentBlock[])
      .map((b) => b.heading)
      .filter((h): h is string => !!h);

    const { newBlocks, checksRun, decision } = await this.generateExpandSections({
      typeConfig: getContentTypeConfig('evento-planazo'),
      subjectLine: `Evento: ${existing.name}`,
      categoryName: category?.name ?? null,
      currentSummary: existing.description ?? '(vacía)',
      existingHeadings,
      instructions: dto.instructions,
      provider: dto.provider,
    });
    const mergedContent = [...(existing.content as ContentBlock[]), ...newBlocks];

    const planazoSite = await this.db.query.sites.findFirst({
      where: eq(sites.slug, 'planazo'),
    });

    await this.db.insert(contentAuditLog).values({
      siteId: planazoSite!.id,
      contentType: 'evento-planazo',
      contentId: id,
      categoryId: category?.id,
      mode: 'expand',
      sourceContext: { instructions: dto.instructions ?? null },
      inputFacts: { existingHeadings },
      aiModel: dto.provider === 'claude-cli' ? 'claude-cli' : 'gpt-4o-mini',
      aiOutput: { content: newBlocks } as Record<string, unknown>,
      checksRun,
      decision,
      statusBefore: existing.status,
      statusAfter: existing.status,
      actorId: actorId ?? null,
    });

    return {
      draft: { content: mergedContent },
      checksRun,
      decision,
      image: null,
      articleImages: [],
      imageSearchQuery: '',
      sourceUrl: null,
      categoryId: category?.id ?? '',
      site: 'planazo',
      contentType: 'evento-planazo',
    };
  }

  /** "Agregar contenido" para los 6 tipos de la-mira (post-creación). */
  private async expandLamiraContent(
    type: string,
    id: string,
    dto: ImproveRequestDto,
    actorId?: string,
  ): Promise<DraftResult> {
    const { table, queryKey } = this.lamiraTableInfo(type);
    const existing = await (
      this.db.query[queryKey] as never as (typeof this.db.query)['noticias']
    ).findFirst({
      where: eq(table.id, id),
      with: { category: true },
    });
    if (!existing) throw new NotFoundException(`"${type}" "${id}" no existe`);

    const row = existing as unknown as Record<string, unknown>;
    const category = (
      existing as { category: { id: string; name: string } | null }
    ).category;
    const existingContent = (row.content ?? []) as ContentBlock[];
    const existingHeadings = existingContent
      .map((b) => b.heading)
      .filter((h): h is string => !!h);

    const { newBlocks, checksRun, decision } = await this.generateExpandSections({
      typeConfig: getContentTypeConfig(type),
      subjectLine: `${getContentTypeConfig(type).label}: ${this.lamiraTitle(type, row)}`,
      categoryName: category?.name ?? null,
      currentSummary: this.lamiraCurrentText(type, row),
      existingHeadings,
      instructions: dto.instructions,
      provider: dto.provider,
    });

    // Solo 'guia' requiere `id` por bloque (ver withGuiaBlockIds) — el resto
    // usa el ContentBlock genérico tal cual sale de generateExpandSections.
    const mergedContent =
      type === 'guia'
        ? [...existingContent, ...this.withGuiaBlockIds(newBlocks, existingContent as unknown as { id: string; heading: string }[])]
        : [...existingContent, ...newBlocks];

    const site = await this.db.query.sites.findFirst({
      where: eq(sites.slug, 'la-mira'),
    });
    const statusValue = (
      typeof row.status === 'string' ? row.status : 'published'
    ) as ContentStatus;

    await this.db.insert(contentAuditLog).values({
      siteId: site!.id,
      contentType: type,
      contentId: id,
      categoryId: category?.id,
      mode: 'expand',
      sourceContext: { instructions: dto.instructions ?? null },
      inputFacts: { existingHeadings },
      aiModel: dto.provider === 'claude-cli' ? 'claude-cli' : 'gpt-4o-mini',
      aiOutput: { content: newBlocks } as Record<string, unknown>,
      checksRun,
      decision,
      statusBefore: statusValue,
      statusAfter: statusValue,
      actorId: actorId ?? null,
    });

    return {
      draft: { content: mergedContent },
      checksRun,
      decision,
      image: null,
      articleImages: [],
      imageSearchQuery: '',
      sourceUrl: null,
      categoryId: category?.id ?? '',
      site: 'la-mira',
      contentType: type,
    };
  }

  /** "Generar más contenido" ANTES de crear — Centro IA, pantalla de revisión
   * del borrador (ver draftExpandRequestSchema). Mismo núcleo que arriba,
   * pero sin fetch a BD (el cliente manda el estado actual del borrador) ni
   * auditoría (draft() tampoco audita — esto no existe todavía como fila). */
  async expandDraft(dto: DraftExpandRequestDto): Promise<DraftResult> {
    const typeConfig = getContentTypeConfig(dto.contentType);
    const category = dto.categoryId
      ? await this.db.query.categories.findFirst({ where: eq(categories.id, dto.categoryId) })
      : null;
    const existingContent = dto.content ?? [];
    const existingHeadings = existingContent
      .map((b) => b.heading)
      .filter((h): h is string => !!h);

    const { newBlocks, checksRun, decision } = await this.generateExpandSections({
      typeConfig,
      subjectLine: `${typeConfig.label}: ${dto.name}`,
      categoryName: category?.name ?? null,
      currentSummary: dto.description || (existingContent.length ? JSON.stringify(existingContent) : '(vacío)'),
      existingHeadings,
      instructions: dto.instructions,
      provider: dto.provider,
    });

    const mergedContent =
      dto.contentType === 'guia'
        ? [...existingContent, ...this.withGuiaBlockIds(newBlocks, existingContent as unknown as { id: string; heading: string }[])]
        : [...existingContent, ...newBlocks];

    return {
      draft: { content: mergedContent },
      checksRun,
      decision,
      image: null,
      articleImages: [],
      imageSearchQuery: '',
      sourceUrl: null,
      categoryId: dto.categoryId ?? '',
      site: typeConfig.site,
      contentType: dto.contentType,
    };
  }

  /** "Mejorar" para eventos de Planazo (evento-planazo) — mismo patrón que
   * improvePlace: sin fieldSchema.shape en el schema que ve el modelo
   * (protección estructural, no solo de prompt, contra que "invente" datos
   * verificables), solo toca descripción+SEO. */
  async improvePlanazoEvento(
    id: string,
    dto: ImproveRequestDto,
    actorId?: string,
  ): Promise<DraftResult> {
    const existing = await this.db.query.events.findFirst({
      where: eq(events.id, id),
      with: { category: true },
    });
    if (!existing) throw new NotFoundException(`Evento "${id}" no existe`);

    const category = existing.category;
    const typeConfig = getContentTypeConfig('evento-planazo');
    const fullSchema = z.object({
      seo: z.object(seoShape),
      ...typeConfig.editorialShape,
    });

    const originalFacts: Record<string, unknown> = { ...existing.categoryData };

    const userPrompt = [
      `Tipo de contenido: ${typeConfig.label}`,
      `Nombre: ${existing.name}`,
      `Descripción actual: ${existing.description ?? '(vacía — redáctala desde cero con lo que sabes del nombre)'}`,
      `Categoría: ${category?.name ?? '(sin categoría)'}`,
      dto.instructions ? `Instrucción del editor: ${dto.instructions}` : '',
      '',
      'Tu trabajo es MEJORAR la redacción y el SEO. No te pido ningún dato verificable (fecha, hora, lugar) — esos ya están capturados aparte y no forman parte de tu respuesta.',
      Object.keys(originalFacts).length
        ? `Para contexto, así están hoy los datos verificables de este evento (no forman parte de tu respuesta, son solo referencia): ${JSON.stringify(originalFacts)}`
        : '',
    ]
      .filter(Boolean)
      .join('\n');

    const improveSystemPrompt = `${typeConfig.systemPrompt}\n\nEstás MEJORANDO contenido existente, no creando desde cero: expande texto genérico/ambiguo. Tu respuesta solo lleva los campos editoriales (descripción, SEO) que te pide el schema — nunca fecha, hora, lugar ni ningún otro dato verificable.`;

    const output = await this.providers.get(dto.provider).generateStructured({
      systemPrompt: improveSystemPrompt,
      userPrompt,
      schema: fullSchema,
      schemaName: 'evento-planazo_improve',
    });

    const { checksRun, decision } = this.checks.run({
      mode: 'improve',
      requiredFields: [...typeConfig.requiredEditorialFields],
      factFields: category ? factKeys(category.fieldSchema) : [],
      draftData: output,
      originalFacts,
      seo: (output as { seo?: { title?: string; description?: string } }).seo,
      hasImageWithAlt: undefined, // Planazo evento no modela imagen todavía — no bloquea
      slugAvailable: true, // el slug no cambia en "improve"
      bodyText: JSON.stringify(output),
    });

    const planazoSite = await this.db.query.sites.findFirst({
      where: eq(sites.slug, 'planazo'),
    });

    await this.db.insert(contentAuditLog).values({
      siteId: planazoSite!.id,
      contentType: 'evento-planazo',
      contentId: id,
      categoryId: category?.id,
      mode: 'improve',
      sourceContext: { instructions: dto.instructions ?? null },
      inputFacts: originalFacts,
      aiModel: dto.provider === 'claude-cli' ? 'claude-cli' : 'gpt-4o-mini',
      aiOutput: output as Record<string, unknown>,
      checksRun,
      decision,
      // Los eventos de Planazo no tienen workflow de borrador (se publican de
      // inmediato al crearse) — "mejorar" nunca cambia ese status.
      statusBefore: existing.status,
      statusAfter: existing.status,
      actorId: actorId ?? null,
    });

    return {
      draft: output,
      checksRun,
      decision,
      image: null,
      articleImages: [],
      imageSearchQuery: '',
      sourceUrl: null,
      categoryId: category?.id ?? '',
      site: 'planazo',
      contentType: 'evento-planazo',
    };
  }

  /** Los 6 tipos de la-mira con CRUD real (Fase 2) — 'place' sigue por separado
   * arriba porque su categoría es una relación N:M (placeCategories), no una
   * columna categoryId directa como en estos. `queryKey` es el nombre que usa
   * `db.query.<queryKey>` (Drizzle no permite indexar `db.query` por la tabla
   * misma, solo por su nombre de export). */
  private lamiraTableInfo(type: string): {
    table: typeof noticias;
    queryKey:
      | 'noticias'
      | 'alertas'
      | 'guias'
      | 'lamiraEventos'
      | 'lamiraLugares'
      | 'reportajes';
  } {
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
        throw new BadRequestException(
          `"Mejorar" no está implementado para el tipo "${type}".`,
        );
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
  private lamiraCurrentText(
    type: string,
    row: Record<string, unknown>,
  ): string {
    switch (type) {
      case 'noticia':
      case 'reportaje':
        return JSON.stringify({ dek: row.dek, content: row.content });
      case 'guia':
        return JSON.stringify({
          dek: row.dek,
          content: row.content,
          faq: row.faq,
        });
      case 'alerta':
      case 'evento':
      case 'lugar':
        return (
          (row.description as string) ??
          '(vacía — redáctala desde cero con lo que sabes del título)'
        );
      default:
        return '';
    }
  }

  /** Enruta improve/:type/:id al método correcto — 'place' ya tenía su propia
   * implementación probada (Fase 3); los 6 tipos de la-mira comparten una
   * sola implementación genérica porque su forma (categoryId directo,
   * categoryData jsonb, seo jsonb) ya es idéntica entre sí. */
  async improveContent(
    type: string,
    id: string,
    dto: ImproveRequestDto,
    actorId?: string,
  ): Promise<DraftResult> {
    if (type === 'place') return this.improvePlace(id, dto, actorId);
    if (dto.mode === 'expand') {
      if (type === 'evento-planazo')
        return this.expandPlanazoEvento(id, dto, actorId);
      return this.expandLamiraContent(type, id, dto, actorId);
    }
    if (type === 'evento-planazo')
      return this.improvePlanazoEvento(id, dto, actorId);
    return this.improveLamiraContent(type, id, dto, actorId);
  }

  private async improveLamiraContent(
    type: string,
    id: string,
    dto: ImproveRequestDto,
    actorId?: string,
  ): Promise<DraftResult> {
    const { table, queryKey } = this.lamiraTableInfo(type);
    const existing = await (
      this.db.query[queryKey] as never as (typeof this.db.query)['noticias']
    ).findFirst({
      where: eq(table.id, id),
      with: { category: true },
    });
    if (!existing) throw new NotFoundException(`"${type}" "${id}" no existe`);

    const typeConfig = getContentTypeConfig(type);
    const category = (
      existing as {
        category: {
          id: string;
          name: string;
          fieldSchema: import('@planazo/types').FieldSchemaEntry[];
        } | null;
      }
    ).category;
    // A propósito SIN fieldSchema.shape aquí (a diferencia de draft()) — ver el
    // mismo comentario en improvePlace más arriba: protección estructural, no
    // solo de prompt, contra que el modelo "invente" campos de categoría.
    const fullSchema = z.object({
      seo: z.object(seoShape),
      ...typeConfig.editorialShape,
    });

    const row = existing as unknown as Record<string, unknown>;
    const originalFacts: Record<string, unknown> = {
      ...(row.categoryData as Record<string, unknown>),
    };

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
      draftData: output,
      originalFacts,
      seo: (output as { seo?: { title?: string; description?: string } }).seo,
      // la-mira no modela fotos con alt todavía (a diferencia de Place) — no hay
      // nada que chequear, no bloquea.
      hasImageWithAlt: undefined,
      slugAvailable: true, // el slug no cambia en "improve"
      bodyText: JSON.stringify(output),
    });

    const site = await this.db.query.sites.findFirst({
      where: eq(sites.slug, 'la-mira'),
    });
    // noticia/guia/reportaje tienen `status` (ContentStatus real, igual que Place);
    // alerta/evento/lugar no tienen ese concepto — el contenido migrado en Fase 6
    // ya está publicado en el sitio, así que se registra como tal.
    const statusValue = (
      typeof row.status === 'string' ? row.status : 'published'
    ) as ContentStatus;

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

    // "Mejorar" edita contenido ya existente — no toca la imagen (eso vive
    // aparte, en el registro que ya se creó); Fase 4 solo cubre el draft nuevo.
    return {
      draft: output,
      checksRun,
      decision,
      image: null,
      articleImages: [],
      imageSearchQuery: '',
      sourceUrl: null,
      categoryId: category?.id ?? '',
      site: 'la-mira',
      contentType: type,
    };
  }

  // Otra forma de conseguir imagen además de buscar (Wikimedia/Openverse) o
  // usar la del artículo ya scrapeado: el editor pega la URL de OTRA nota que
  // hable del mismo tema (de otra fuente) y solo se saca su imagen principal,
  // citando esa fuente — nunca se lee/parafrasea su texto (por eso reusa
  // ArticleScraperService.scrape pero descarta `.text` a propósito).
  async fetchImageFromUrl(
    url: string,
  ): Promise<{ url: string; credit: string } | null> {
    const scraped = await this.scraper.scrape(url);
    if (!scraped?.imageUrl) return null;
    return { url: scraped.imageUrl, credit: `Foto: ${scraped.siteName}` };
  }
}
