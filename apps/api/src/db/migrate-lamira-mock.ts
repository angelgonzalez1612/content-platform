import 'dotenv/config';
import { readFileSync } from 'fs';
import { join } from 'path';
import { eq, and } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/libsql';
import { createClient } from '@libsql/client';
import * as schema from './schema';

// Fase 6 del plan de content-platform: migra el contenido mock existente de
// la-mira (src/data/mock/*.ts, exportado a JSON el 2026-08-25 — ver
// seed-data/lamira-mock/) hacia el backend real, con site_id='la-mira' y
// status='published' (el mock siempre se consideró "ya publicado" en el
// sitio — ver el comentario original en la-mira/src/lib/types.ts).
//
// Mapeo de categorías (Fase 0 → Fase 6, revisado a mano el 2026-08-25):
// - La mayoría de los `categorySlug`/`topicSlug`/`category` del mock ya
//   coinciden 1:1 con un slug canónico (trafico, seguridad, metro, ciudad,
//   clima, politica, medio-ambiente, cultura, economia, tecnologia).
// - "gastronomia" (nombre viejo) -> "comer" (nombre canónico, mismo
//   concepto, ver Fase 0 del plan).
// - "entretenimiento" fue ELIMINADA en la Fase 0 (no tenía un ángulo propio
//   consistente) — se remapea caso por caso, contenido por contenido, como
//   preveía el plan:
//     * "museos-gratis-visitar-ciudad-mexico" (noticia sobre museos) -> cultura
//     * "agenda-eventos-cdmx-24-28-agosto" (agenda genérica de la semana) -> eventos
//     * "pumas-cruz-azul-final-liga-mx-2026" (final de fútbol, tag DEPORTES) -> deportes
//     * "torneo-ajedrez-parque-espana" (evento, torneo competitivo) -> deportes
//     * "cine-al-aire-libre-chapultepec" (evento, proyección de cine) -> cine-tv
// - Guías (`groupSlug`: licencias-y-manejo, vehiculos-y-placas, etc.) NO
//   tienen equivalente en las 27 categorías canónicas — son trámites, no
//   temas editoriales/de descubrimiento. Se dejan con categoryId=null a
//   propósito (igual que documenta el propio schema en lamira.ts).
// - Lugares (`kind`: parque/plaza/museo/etc.) tampoco tiene categoría en el
//   mock original — se deja categoryId=null para las 12; `kind` ya captura
//   la clasificación real del lugar.
// - Reportajes: el mock nunca tuvo categorySlug (solo `tags` libres) y el
//   propio schema documenta "queda nullable para no forzarlo" — se
//   respeta, categoryId=null para los 3.

const DATA_DIR = join(__dirname, 'seed-data', 'lamira-mock');
function loadJson<T>(file: string, exportName: string): T {
  const parsed = JSON.parse(readFileSync(join(DATA_DIR, file), 'utf8'));
  return parsed[exportName];
}

interface MockNoticia {
  id: string;
  slug: string;
  title: string;
  dek: string;
  categorySlug: string;
  alcaldiaSlug?: string;
  colonia?: string;
  authorSlug: string;
  publishedAt: string;
  updatedAt?: string;
  readingTime: string;
  sourceKind?: string;
  externalSource?: string;
  youtubeId?: string;
  tags?: string[];
  seo?: { title?: string; description?: string };
  toc: { id: string; label: string }[];
  content: { heading?: string; paragraphs: string[] }[];
  imageCaption?: string;
  featured?: boolean;
  tag?: string;
}

interface MockAlerta {
  id: string;
  slug: string;
  title: string;
  status: string;
  topicSlug: string;
  alcaldiaSlug?: string;
  updatedAt: string;
  description: string;
  updates: { time: string; text: string }[];
  seo?: { title?: string; description?: string };
}

interface MockGuide {
  id: string;
  slug: string;
  title: string;
  dek: string;
  groupSlug: string;
  updatedAt: string;
  readingTime: string;
  officialSource: { label: string; url: string };
  quickFacts: { label: string; value: string }[];
  seo?: { title?: string; description?: string };
  toc: { id: string; label: string }[];
  content: { id: string; heading: string; paragraphs: string[] }[];
  faq: { question: string; answer: string }[];
}

interface MockEvento {
  id: string;
  slug: string;
  title: string;
  tag: string;
  category: string;
  status: string;
  date: string;
  time: string;
  location: string;
  alcaldiaSlug?: string;
  price: string;
  description: string;
  organizer: string;
  officialUrl?: string;
  seo?: { title?: string; description?: string };
}

interface MockLugar {
  id: string;
  slug: string;
  name: string;
  kind: string;
  alcaldiaSlug: string;
  colonia?: string;
  description: string;
  seo?: { title?: string; description?: string };
}

interface MockReportaje {
  id: string;
  slug: string;
  title: string;
  dek: string;
  authorSlug: string;
  publishedAt: string;
  readingTime: string;
  tags: string[];
  sourceKind?: string;
  seo?: { title?: string; description?: string };
  imageCaption: string;
  toc: { id: string; label: string }[];
  content: { heading?: string; paragraphs: string[] }[];
}

// old slug (mock) -> canonical slug (Fase 0) — aplica a noticias.categorySlug y eventos.category
const CATEGORY_RENAME: Record<string, string> = { gastronomia: 'comer' };

// override explícito por slug de contenido — resuelve los casos "entretenimiento"
// (eliminada en Fase 0) uno por uno, como exigía el plan.
const NOTICIA_CATEGORY_OVERRIDE: Record<string, string> = {
  'museos-gratis-visitar-ciudad-mexico': 'cultura',
  'agenda-eventos-cdmx-24-28-agosto': 'eventos',
  'pumas-cruz-azul-final-liga-mx-2026': 'deportes',
};
const EVENTO_CATEGORY_OVERRIDE: Record<string, string> = {
  'torneo-ajedrez-parque-espana': 'deportes',
  'cine-al-aire-libre-chapultepec': 'cine-tv',
};

function resolveCategorySlug(oldSlug: string, override?: string): string {
  if (override) return override;
  return CATEGORY_RENAME[oldSlug] ?? oldSlug;
}

async function main() {
  const client = createClient({ url: process.env.DATABASE_URL ?? 'file:./data/dev.sqlite' });
  const db = drizzle(client, { schema });

  const site = await db.query.sites.findFirst({ where: eq(schema.sites.slug, 'la-mira') });
  if (!site) throw new Error("Sitio 'la-mira' no existe — corre antes db:seed:categories.");

  const allCategories = await db.query.categories.findMany();
  const categoryIdBySlug = new Map(allCategories.map((c) => [c.slug, c.id]));
  function categoryId(slug: string | null): string | null {
    if (!slug) return null;
    const id = categoryIdBySlug.get(slug);
    if (!id) throw new Error(`Categoría "${slug}" no existe en la tabla categories.`);
    return id;
  }

  let created = 0;
  let updated = 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- script de migración
  // uno-a-uno, no vale la pena tipar genéricamente sobre 6 tablas con formas distintas.
  async function upsert(table: any, slug: string, values: Record<string, unknown>): Promise<void> {
    const existing = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.slug, slug), eq(table.siteId, site!.id)))
      .limit(1);
    if (existing.length > 0) {
      await db.update(table).set(values).where(eq(table.id, existing[0].id));
      updated += 1;
    } else {
      await db.insert(table).values({ slug, siteId: site!.id, ...values });
      created += 1;
    }
  }

  // ── Noticias ────────────────────────────────────────────────────────────
  const noticias = loadJson<MockNoticia[]>('news.json', 'NOTICIAS');
  for (const n of noticias) {
    await upsert(schema.noticias, n.slug, {
      title: n.title,
      dek: n.dek,
      categoryId: categoryId(resolveCategorySlug(n.categorySlug, NOTICIA_CATEGORY_OVERRIDE[n.slug])),
      alcaldiaSlug: n.alcaldiaSlug ?? null,
      colonia: n.colonia ?? null,
      authorSlug: n.authorSlug,
      publishedAt: new Date(n.publishedAt),
      updatedAt: n.updatedAt ? new Date(n.updatedAt) : null,
      readingTime: n.readingTime,
      status: 'published',
      sourceKind: n.sourceKind ?? null,
      externalSource: n.externalSource ?? null,
      youtubeId: n.youtubeId ?? null,
      tags: n.tags ?? [],
      seo: n.seo ?? null,
      toc: n.toc,
      content: n.content,
      imageCaption: n.imageCaption ?? null,
      featured: n.featured ?? false,
      tag: n.tag ?? null,
      categoryData: {},
    });
  }
  console.log(`Noticias: ${noticias.length} procesadas.`);

  // ── Alertas ─────────────────────────────────────────────────────────────
  const alertas = loadJson<MockAlerta[]>('alerts.json', 'ALERTAS');
  for (const a of alertas) {
    await upsert(schema.alertas, a.slug, {
      title: a.title,
      alertaStatus: a.status,
      categoryId: categoryId(resolveCategorySlug(a.topicSlug)),
      alcaldiaSlug: a.alcaldiaSlug ?? null,
      updatedAt: new Date(a.updatedAt),
      description: a.description,
      updates: a.updates,
      seo: a.seo ?? null,
      categoryData: {},
    });
  }
  console.log(`Alertas: ${alertas.length} procesadas.`);

  // ── Guías (categoryId siempre null — ver nota arriba) ──────────────────
  const guias = loadJson<MockGuide[]>('guides.json', 'GUIDES');
  for (const g of guias) {
    await upsert(schema.guias, g.slug, {
      title: g.title,
      dek: g.dek,
      groupSlug: g.groupSlug,
      categoryId: null,
      updatedAt: new Date(g.updatedAt),
      readingTime: g.readingTime,
      status: 'published',
      officialSource: g.officialSource ?? null,
      quickFacts: g.quickFacts,
      seo: g.seo ?? null,
      toc: g.toc,
      content: g.content,
      faq: g.faq,
      categoryData: {},
    });
  }
  console.log(`Guías: ${guias.length} procesadas.`);

  // ── Eventos ─────────────────────────────────────────────────────────────
  const eventos = loadJson<MockEvento[]>('events.json', 'EVENTOS');
  for (const e of eventos) {
    await upsert(schema.lamiraEventos, e.slug, {
      title: e.title,
      tag: e.tag,
      categoryId: categoryId(resolveCategorySlug(e.category, EVENTO_CATEGORY_OVERRIDE[e.slug])),
      eventoStatus: e.status,
      date: e.date,
      time: e.time,
      location: e.location,
      alcaldiaSlug: e.alcaldiaSlug ?? null,
      price: e.price,
      description: e.description,
      organizer: e.organizer,
      officialUrl: e.officialUrl ?? null,
      seo: e.seo ?? null,
      categoryData: {},
    });
  }
  console.log(`Eventos: ${eventos.length} procesados.`);

  // ── Lugares (categoryId siempre null — ver nota arriba) ─────────────────
  const lugares = loadJson<MockLugar[]>('places.json', 'LUGARES');
  for (const l of lugares) {
    await upsert(schema.lamiraLugares, l.slug, {
      name: l.name,
      kind: l.kind,
      categoryId: null,
      alcaldiaSlug: l.alcaldiaSlug,
      colonia: l.colonia ?? null,
      description: l.description,
      seo: l.seo ?? null,
      categoryData: {},
    });
  }
  console.log(`Lugares: ${lugares.length} procesados.`);

  // ── Reportajes (categoryId siempre null — ver nota arriba) ──────────────
  const reportajes = loadJson<MockReportaje[]>('reportajes.json', 'REPORTAJES');
  for (const r of reportajes) {
    await upsert(schema.reportajes, r.slug, {
      title: r.title,
      dek: r.dek,
      authorSlug: r.authorSlug,
      categoryId: null,
      publishedAt: new Date(r.publishedAt),
      readingTime: r.readingTime,
      status: 'published',
      tags: r.tags,
      sourceKind: r.sourceKind ?? null,
      seo: r.seo ?? null,
      imageCaption: r.imageCaption,
      toc: r.toc,
      content: r.content,
      categoryData: {},
    });
  }
  console.log(`Reportajes: ${reportajes.length} procesados.`);

  console.log(`\nTotal: ${created} creados, ${updated} actualizados.`);
  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
