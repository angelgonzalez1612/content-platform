import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { AiDraftService } from '../modules/ai/ai-draft.service';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Plan "empezar de nuevo con información buena para AdSense" (2026-09-08):
// ronda 2 de expand-short-place-descriptions.ts (que ya cubrió <40 palabras)
// — ahora el umbral sube a <100 palabras, escoged solo a los lugares del
// mock que SÍ se quedan (ya tienen foto real verificada a mano tras el
// rescate de fotos) — el resto de lugares sin foto se están borrando por
// separado.
//
// Uso: pnpm db:expand-place-descriptions-round2

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);
  const aiDraft = app.get(AiDraftService);

  const allPlaces = await db.query.places.findMany({ with: { photos: true } });
  const targets = allPlaces.filter(
    (p) => p.photos.length > 0 && (p.description ?? '').trim().split(/\s+/).filter(Boolean).length < 100,
  );

  console.log(`${targets.length} lugares bajo 100 palabras (con foto real) encontrados.`);

  let applied = 0;
  let needsReview = 0;

  for (const place of targets) {
    const before = (place.description ?? '').trim().split(/\s+/).filter(Boolean).length;
    try {
      const result = await aiDraft.improveContent('place', place.id, {
        mode: 'rewrite',
        instructions:
          'La descripción actual quedó demasiado corta. Expándela a 80-120 palabras, mismo tono editorial, sin inventar dirección/teléfono/precios/horarios ni ningún otro dato verificable que no esté ya dado.',
        provider: 'claude-cli',
      });

      const draft = result.draft as { description?: string; seo?: { title?: string; description?: string } };
      const after = (draft.description ?? '').trim().split(/\s+/).filter(Boolean).length;

      const relevantFailures = result.checksRun.filter((c) => c.blocking && !c.passed);
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
