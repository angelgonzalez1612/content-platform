import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import { ImageSearchService } from '../modules/ai/image-search.service';
import * as schema from './schema';

// Parte del plan de depuración para AdSense (2026-09-07): 123 fotos de
// `picsum.photos` (placeholder aleatorio) y 168 de `images.unsplash.com`
// (stock genérico) migradas del mock original de Planazo
// (migrate-planazo-mock.ts) — ninguna es una foto real del lugar. Se
// reemplazan con un resultado real de ImageSearchService (Wikimedia Commons +
// Openverse, ya filtrado a licencias de uso comercial — mismo criterio
// "seguro para AdSense" que ya usa AiDraftService para contenido nuevo). Si
// no hay resultado razonable, se borra la foto: mejor sin foto que una falsa.
//
// Uso: pnpm db:fix-place-photos

const FAKE_HOSTS = ['picsum.photos', 'images.unsplash.com'];
const DELAY_MS = 300; // no saturar las APIs públicas de Wikimedia/Openverse

function isFakePhoto(url: string): boolean {
  try {
    return FAKE_HOSTS.includes(new URL(url).hostname);
  } catch {
    return false;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);
  const imageSearch = app.get(ImageSearchService);

  const places = await db.query.places.findMany({
    with: {
      photos: true,
      placeCategories: { with: { category: true } },
    },
  });

  let replaced = 0;
  let removed = 0;
  let kept = 0;
  let scanned = 0;

  for (const place of places) {
    const fakePhotos = place.photos.filter((p) => isFakePhoto(p.url));
    if (fakePhotos.length === 0) continue;

    const categoryName = place.placeCategories[0]?.category?.name ?? '';
    const query = `${place.name} ${categoryName} CDMX`.trim();

    for (const photo of fakePhotos) {
      scanned += 1;
      const results = await imageSearch.search(query);
      await sleep(DELAY_MS);

      if (results.length > 0) {
        const best = results[0];
        await db
          .update(schema.photos)
          .set({ url: best.url, credit: best.credit })
          .where(eq(schema.photos.id, photo.id));
        replaced += 1;
        console.log(`REEMPLAZADA | ${place.name} | ${photo.url} -> ${best.url} (${best.credit})`);
      } else {
        await db.delete(schema.photos).where(eq(schema.photos.id, photo.id));
        removed += 1;
        console.log(`QUITADA (sin resultado real) | ${place.name} | ${photo.url}`);
      }
    }
  }

  for (const place of places) {
    kept += place.photos.filter((p) => !isFakePhoto(p.url)).length;
  }

  console.log(`\nTotal: ${scanned} fotos falsas evaluadas — ${replaced} reemplazadas, ${removed} quitadas.`);
  console.log(`Fotos reales que ya existían y no se tocaron: ${kept}.`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
