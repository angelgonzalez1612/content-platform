import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { slugify } from '@planazo/shared';
import type { ContentBlock } from '@planazo/types';
import { AppModule } from '../app.module';
import { AiDraftService } from '../modules/ai/ai-draft.service';
import { ChecksService } from '../modules/ai/checks.service';
import { getContentTypeConfig } from '../modules/ai/content-types';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Parte del plan de depuración para AdSense (2026-09-07): antes de subir el
// umbral de `calidad-longitud` (40 -> 300 palabras en checks.service.ts), la
// automatización publicó noticias/reportajes de hasta 33-52 palabras sin
// disparar nunca `expandIfShort` (el check nunca fallaba con el umbral
// viejo). Este script corrige lo YA publicado: expande con IA cada pieza
// bajo el nuevo umbral, mismo mecanismo que ya usa
// AutomationRunnerService.maybeExpandContent en producción
// (AiDraftService.expandDraft, que agrega 1-3 secciones nuevas sin tocar lo
// existente). Solo aplica a noticia/reportaje — alerta no tiene bloques de
// contenido que expandir (su cuerpo es un solo `description`, ver
// content-types.ts), place/evento-planazo tampoco.
//
// Uso: pnpm db:expand-short-lamira-content

const WORD_THRESHOLD = 300;

interface TypeSpec {
  type: 'noticia' | 'reportaje';
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mismo patrón que apply-mejorar-lamira.ts
  table: any;
  findAll: (db: DrizzleDb) => Promise<(typeof schema.noticias.$inferSelect | typeof schema.reportajes.$inferSelect)[]>;
}

const TYPES: TypeSpec[] = [
  { type: 'noticia', table: schema.noticias, findAll: (db) => db.query.noticias.findMany() },
  { type: 'reportaje', table: schema.reportajes, findAll: (db) => db.query.reportajes.findMany() },
];

function countWords(content: ContentBlock[]): number {
  return content.reduce((total, block) => {
    const heading = block.heading?.trim().split(/\s+/).filter(Boolean).length ?? 0;
    const paragraphs = block.paragraphs.reduce((sum, p) => sum + p.trim().split(/\s+/).filter(Boolean).length, 0);
    return total + heading + paragraphs;
  }, 0);
}

function buildToc(content: ContentBlock[]): { id: string; label: string }[] {
  return content
    .filter((b) => b.heading?.trim())
    .map((b) => ({ id: slugify(b.heading!.trim()), label: b.heading!.trim() }));
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);
  const aiDraft = app.get(AiDraftService);
  const checks = app.get(ChecksService);

  let expanded = 0;
  let needsReview = 0;
  let alreadyOk = 0;

  for (const spec of TYPES) {
    const rows = await spec.findAll(db);

    for (const row of rows) {
      const content = (row.content ?? []) as ContentBlock[];
      const words = countWords(content);
      if (words >= WORD_THRESHOLD) {
        alreadyOk += 1;
        continue;
      }

      try {
        const result = await aiDraft.expandDraft({
          contentType: spec.type,
          name: row.title,
          description: row.dek ?? null,
          content,
          categoryId: row.categoryId,
          provider: 'claude-cli',
        });
        const mergedContent = (result.draft as { content: ContentBlock[] }).content;
        const newWords = countWords(mergedContent);

        // OJO: expandDraft() solo devuelve el `content` incremental, no el
        // draft completo — armar draftData desde la fila EXISTENTE (título/dek
        // reales ya publicados), no desde result.draft (que no trae title/dek
        // y hacía fallar 'completitud' por campos que ni siquiera se están
        // tocando). `imageSearchQuery` no es una columna persistida (solo
        // sirvió para buscar la imagen ya publicada) — valor fijo, ya cumplió
        // su propósito, no se vuelve a buscar imagen aquí.
        const typeConfig = getContentTypeConfig(spec.type);
        const draftData = { title: row.title, dek: row.dek, content: mergedContent, imageSearchQuery: 'ya-publicada' };
        const { decision, checksRun } = checks.run({
          mode: 'improve',
          contentType: spec.type,
          requiredFields: [...typeConfig.requiredEditorialFields],
          factFields: [], // no se tocan campos-hecho, solo se agrega cuerpo
          draftData,
          seo: (row.seo as { title?: string; description?: string } | null) ?? undefined,
          hasImageWithAlt: true, // ya tenía imagen desde que se publicó, no se toca
          slugAvailable: true,
          bodyText: JSON.stringify(draftData),
        });

        if (decision !== 'auto-published') {
          const failing = checksRun.filter((c) => c.blocking && !c.passed).map((c) => c.name);
          console.log(`REVISIÓN MANUAL [${spec.type}] "${row.title}" — falló: ${failing.join(', ')}`);
          needsReview += 1;
          continue;
        }

        await db
          .update(spec.table)
          .set({ content: mergedContent, toc: buildToc(mergedContent), updatedAt: new Date() })
          .where(eq(spec.table.id, row.id));

        console.log(`EXPANDIDA [${spec.type}] "${row.title}" — ${words} -> ${newWords} palabras`);
        expanded += 1;
      } catch (err) {
        console.log(`ERROR [${spec.type}] "${row.title}" — ${(err as Error).message.slice(0, 200)}`);
        needsReview += 1;
      }
    }
  }

  console.log(`\nTotal: ${expanded} expandidas, ${needsReview} necesitan revisión manual, ${alreadyOk} ya cumplían el umbral.`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
