import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { AiDraftService } from '../modules/ai/ai-draft.service';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Fase 6.5 del plan de content-platform: corre "Mejorar con IA" sobre TODO
// el contenido de la-mira migrado en la Fase 6 (el usuario calificó el
// original como "muy ambiguo" en algunos casos). Cuando los checks
// automáticos pasan (misma lógica que usaría un editor humano en el CMS —
// ver ChecksService), aplica el texto mejorado directamente. Cuando no,
// deja el contenido tal cual y lo agrega a la cola de revisión manual — esta
// pasada NUNCA cambia campos-hecho ni el status editorial, solo prosa/SEO.
//
// Uso: pnpm db:apply-mejorar-lamira            (todo)
//      pnpm db:apply-mejorar-lamira 5           (primeros 5, para probar)

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- 6 tablas con
// forma distinta; no vale la pena tipar genéricamente para un script uno-a-uno.
interface TypeSpec {
  type: string;
  table: any;
  queryKey: 'noticias' | 'alertas' | 'guias' | 'lamiraEventos' | 'lamiraLugares' | 'reportajes';
  hasUpdatedAt: boolean;
  applyFields: (draft: Record<string, unknown>) => Record<string, unknown>;
}

const TYPES: TypeSpec[] = [
  { type: 'noticia', table: schema.noticias, queryKey: 'noticias', hasUpdatedAt: true, applyFields: (d) => ({ dek: d.dek, content: d.content, seo: d.seo }) },
  { type: 'alerta', table: schema.alertas, queryKey: 'alertas', hasUpdatedAt: true, applyFields: (d) => ({ description: d.description, seo: d.seo }) },
  { type: 'guia', table: schema.guias, queryKey: 'guias', hasUpdatedAt: true, applyFields: (d) => ({ dek: d.dek, content: d.content, faq: d.faq, seo: d.seo }) },
  { type: 'evento', table: schema.lamiraEventos, queryKey: 'lamiraEventos', hasUpdatedAt: false, applyFields: (d) => ({ description: d.description, seo: d.seo }) },
  { type: 'lugar', table: schema.lamiraLugares, queryKey: 'lamiraLugares', hasUpdatedAt: false, applyFields: (d) => ({ description: d.description, seo: d.seo }) },
  { type: 'reportaje', table: schema.reportajes, queryKey: 'reportajes', hasUpdatedAt: false, applyFields: (d) => ({ dek: d.dek, content: d.content, seo: d.seo }) },
];

interface ReviewItem {
  type: string;
  slug: string;
  title: string;
  reason: string;
}

async function main() {
  const limit = process.argv[2] ? parseInt(process.argv[2], 10) : Infinity;
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);
  const aiDraft = app.get(AiDraftService);

  const site = await db.query.sites.findFirst({ where: eq(schema.sites.slug, 'la-mira') });
  if (!site) throw new Error("Sitio 'la-mira' no existe.");

  let processed = 0;
  let applied = 0;
  const needsReview: ReviewItem[] = [];

  outer: for (const spec of TYPES) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (db.query as any)[spec.queryKey].findMany({
      where: eq(spec.table.siteId, site.id),
      with: { category: true },
    });

    for (const row of rows) {
      if (processed >= limit) break outer;
      processed++;
      const label = (row.title ?? row.name) as string;
      process.stdout.write(`[${processed}] ${spec.type} "${label}" (${row.slug})... `);

      try {
        const result = await aiDraft.improveContent(spec.type, row.id, { provider: 'claude-cli', mode: 'rewrite' });

        if (result.decision === 'auto-published') {
          const fields = spec.applyFields(result.draft);
          if (spec.hasUpdatedAt) fields.updatedAt = new Date();

          const fieldSchema = (row.category?.fieldSchema ?? []) as { key: string }[];
          if (fieldSchema.length) {
            const dynamic: Record<string, unknown> = {};
            for (const f of fieldSchema) {
              if (result.draft[f.key] !== undefined) dynamic[f.key] = result.draft[f.key];
            }
            if (Object.keys(dynamic).length) {
              fields.categoryData = { ...(row.categoryData as Record<string, unknown>), ...dynamic };
            }
          }

          await db.update(spec.table).set(fields).where(eq(spec.table.id, row.id));
          applied++;
          console.log('OK (aplicado)');
        } else {
          const failed = result.checksRun.filter((c) => c.blocking && !c.passed).map((c) => `${c.name}${c.detail ? ` (${c.detail})` : ''}`);
          needsReview.push({ type: spec.type, slug: row.slug, title: label, reason: failed.join('; ') });
          console.log(`needs-review — ${failed.join('; ')}`);
        }
      } catch (err) {
        needsReview.push({ type: spec.type, slug: row.slug, title: label, reason: `error: ${(err as Error).message}` });
        console.log(`ERROR — ${(err as Error).message}`);
      }
    }
  }

  console.log(`\nTotal: ${processed} procesados, ${applied} aplicados, ${needsReview.length} pendientes de revisión manual.`);
  if (needsReview.length) {
    console.log('\n── Cola de revisión manual (no se tocaron, quedaron con su texto migrado en Fase 6) ──');
    for (const r of needsReview) console.log(`- [${r.type}] ${r.title} (${r.slug}) — ${r.reason}`);
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
