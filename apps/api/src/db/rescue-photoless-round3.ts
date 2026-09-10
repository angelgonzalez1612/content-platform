import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import { ImageSearchService } from '../modules/ai/image-search.service';
import * as schema from './schema';

// Ronda 3 del rescate de fotos (2026-09-08): el reintento con "nombre+CDMX"
// dio 0 resultados para varios lugares que en realidad SÍ deberían tener
// foto real disponible — nombres únicos y globalmente reconocibles (Pujol,
// Quintonil, Zona Arqueológica de Teotihuacán) que la revisión manual del
// candidate-to-delete list identificó como sospechosos de falso NEGATIVO,
// no de falta real de cobertura. Dos causas probables: (a) forzar "CDMX" en
// la consulta es geográficamente incorrecto para destinos que NO están en
// la Ciudad de México propiamente (Teotihuacán es Edomex, Tepoztlán es
// Morelos, Valle de Bravo es Edomex, Tepotzotlán es Edomex); (b) estos
// nombres son lo bastante distintivos (no son palabras genéricas del
// español, a diferencia de "El Cardenal"/"La Caravana"/"Los Danzantes" que
// SÍ dieron falsos positivos en la ronda 2) para buscarse solo por nombre,
// sin sufijo geográfico, sin el riesgo de colisión que tuvo esa ronda.
//
// Uso: pnpm db:rescue-photoless-round3

const CANDIDATE_NAMES = [
  'Pujol',
  'Quintonil',
  'Zinco Jazz Club',
  'Mercado Roma',
  'Jardín Botánico UNAM',
  'MUNET — Museo Nacional de Energía y Tecnología',
  'Universum — Museo de las Ciencias de la UNAM',
  'Bosque de Tlalpan',
  'San Ángel Inn',
  'Lunario del Auditorio Nacional',
  'Foro Indie Rocks!',
  'Pepsi Center WTC',
  'Zona Arqueológica de Teotihuacán',
  'Tepoztlán',
  'Valle de Bravo',
  'Museo Nacional del Virreinato',
  'Licorería Limantour',
  'Licorería Limantour Polanco',
  'Máximo Bistrot',
  'Azul Histórico',
  'Handshake Speakeasy',
  'Cine Tonalá',
  'Antigua Hacienda de Tlalpan',
  'Café El Jarocho',
  'Los Cocuyos',
];

const DELAY_MS = 300;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);
  const imageSearch = app.get(ImageSearchService);

  const places = await db.query.places.findMany({
    where: inArray(schema.places.name, CANDIDATE_NAMES),
    with: { photos: true },
  });

  console.log(`${places.length}/${CANDIDATE_NAMES.length} nombres encontrados en la BD.\n`);

  let rescued = 0;
  let noResult = 0;

  for (const place of places) {
    if (place.photos.length > 0) {
      console.log(`YA TIENE FOTO | ${place.name}`);
      continue;
    }

    const results = await imageSearch.search(place.name);
    await sleep(DELAY_MS);

    if (results.length > 0) {
      const best = results[0];
      await db.insert(schema.photos).values({
        placeId: place.id,
        url: best.url,
        credit: best.credit,
        position: 0,
      });
      console.log(`RESCATADA | ${place.name} -> ${best.url} | ${best.credit}`);
      rescued += 1;
    } else {
      console.log(`SIN RESULTADO | ${place.name}`);
      noResult += 1;
    }
  }

  console.log(`\nTotal: ${rescued} rescatadas, ${noResult} sin resultado.`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
