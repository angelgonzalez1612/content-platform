import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import { ImageSearchService } from '../modules/ai/image-search.service';
import * as schema from './schema';

// Plan "empezar de nuevo con información buena para AdSense" (2026-09-08):
// de los 100 lugares del mock original, 89 se quedaron sin ninguna foto tras
// la limpieza de fotos falsas de ayer (fix-place-photos.ts encontró cero
// resultados con una sola variante de consulta). Antes de decidir cuáles
// borrar, se reintenta con una variante extra (nombre+CDMX, sin categoría) —
// un negocio genérico a veces no aparece con la consulta larga pero sí con
// una más corta. NO se usa "nombre solo" (sin CDMX): se probó y da falsos
// positivos peligrosos — "Terraza Catedral" y "Cine de autor en Cineteca"
// devolvieron fotos de Salamanca y Madrid respectivamente, nombres genéricos
// que también existen fuera de México. Los que NO consiguen ningún
// resultado en ninguna variante quedan reportados en rescue-report.json
// como candidatos a borrar (no se borra nada aquí).
//
// Uso: pnpm db:rescue-photoless-mock-places

const DELAY_MS = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);
  const imageSearch = app.get(ImageSearchService);

  const mockSeedPath = path.join(__dirname, 'seed-data/planazo-mock/places.json');
  const mockSlugs = new Set<string>(
    (JSON.parse(fs.readFileSync(mockSeedPath, 'utf8')) as Array<{ slug: string }>).map((p) => p.slug),
  );

  const allPlaces = await db.query.places.findMany({
    with: { photos: true, placeCategories: { with: { category: true } } },
  });

  const targets = allPlaces.filter((p) => mockSlugs.has(p.slug) && p.photos.length === 0);
  console.log(`${targets.length} lugares mock sin foto encontrados.\n`);

  const rescued: Array<{ id: string; name: string; url: string; credit: string; query: string }> = [];
  const noPhotoFound: Array<{ id: string; name: string; slug: string; description: string | null }> = [];

  for (const place of targets) {
    const categoryName = place.placeCategories[0]?.category?.name ?? '';
    const queries = [
      `${place.name} ${categoryName} CDMX`.trim(),
      `${place.name} CDMX`.trim(),
    ];

    let found: { url: string; credit: string; query: string } | null = null;
    for (const query of queries) {
      const results = await imageSearch.search(query);
      await sleep(DELAY_MS);
      if (results.length > 0) {
        found = { url: results[0].url, credit: results[0].credit, query };
        break;
      }
    }

    if (found) {
      await db.insert(schema.photos).values({
        placeId: place.id,
        url: found.url,
        credit: found.credit,
        position: 0,
      });
      rescued.push({ id: place.id, name: place.name, url: found.url, credit: found.credit, query: found.query });
      console.log(`RESCATADA | ${place.name} | via "${found.query}" -> ${found.url}`);
    } else {
      noPhotoFound.push({ id: place.id, name: place.name, slug: place.slug, description: place.description });
      console.log(`SIN FOTO (candidato a borrar) | ${place.name}`);
    }
  }

  const reportPath =
    process.env.RESCUE_REPORT_PATH ?? path.join(__dirname, '../../rescue-report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ rescued, noPhotoFound }, null, 2));

  console.log(`\nTotal: ${rescued.length} rescatadas con foto real, ${noPhotoFound.length} sin ningún resultado (ver rescue-report.json).`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
