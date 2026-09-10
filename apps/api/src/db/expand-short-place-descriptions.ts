import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { AiDraftService } from '../modules/ai/ai-draft.service';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Parte del plan de depuración para AdSense (2026-09-07, ronda 2): 9 lugares
// de Planazo quedaron con descripciones de 9-39 palabras (el objetivo real
// es 80-120, ver content-types.ts) — la automatización no tiene mecanismo de
// "expandir" para `place` (a diferencia de noticia/reportaje, su
// descripción es un solo string, no bloques de contenido). Reutiliza el
// mismo flujo "Mejorar con IA" que ya existe en el CMS
// (AiDraftService.improvePlace, vía improveContent) — nunca puede escribir
// campos de categoría (dirección/precio/horario), solo prosa+SEO, mismo
// candado estructural que ya protege ese flujo. Usa el proveedor codex-cli
// (a pedido del usuario, para no gastar tokens de Claude redactando texto).
//
// Uso: pnpm db:expand-short-place-descriptions

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);
  const aiDraft = app.get(AiDraftService);

  const shortPlaces = await db.query.places.findMany();
  const targets = shortPlaces.filter((p) => (p.description ?? '').trim().split(/\s+/).filter(Boolean).length < 40);

  console.log(`${targets.length} lugares bajo 40 palabras encontrados.`);

  let applied = 0;
  let needsReview = 0;

  for (const place of targets) {
    const before = (place.description ?? '').trim().split(/\s+/).filter(Boolean).length;
    try {
      const result = await aiDraft.improveContent('place', place.id, {
        mode: 'rewrite',
        instructions:
          'La descripción actual quedó demasiado corta. Expándela a 80-120 palabras, mismo tono editorial, sin inventar dirección/teléfono/precios/horarios ni ningún otro dato verificable que no esté ya dado.',
        provider: 'codex-cli',
      });

      const draft = result.draft as { description?: string; seo?: { title?: string; description?: string } };
      const after = (draft.description ?? '').trim().split(/\s+/).filter(Boolean).length;

      // 'imagen-con-alt' es irrelevante aquí a propósito: este pase solo
      // toca texto (descripción+SEO), la foto se resuelve aparte
      // (find-photos-for-places.ts / fix-mismatched-photos.ts) — los 9
      // lugares de este lote no tienen ninguna foto todavía, así que ese
      // check siempre falla sin importar qué tan buena quede la redacción.
      const relevantFailures = result.checksRun.filter(
        (c) => c.blocking && !c.passed && c.name !== 'imagen-con-alt',
      );
      if (relevantFailures.length > 0) {
        console.log(`REVISIÓN MANUAL | "${place.name}" — falló: ${relevantFailures.map((c) => c.name).join(', ')}`);
        needsReview += 1;
        continue;
      }

      await db
        .update(schema.places)
        .set({ description: draft.description, seo: draft.seo, updatedAt: new Date() })
        .where(eq(schema.places.id, place.id));

      console.log(`EXPANDIDA | "${place.name}" — ${before} -> ${after} palabras`);
      applied += 1;
    } catch (err) {
      console.log(`ERROR | "${place.name}" — ${(err as Error).message.slice(0, 200)}`);
      needsReview += 1;
    }
  }

  console.log(`\nTotal: ${applied} expandidas, ${needsReview} necesitan revisión manual.`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
