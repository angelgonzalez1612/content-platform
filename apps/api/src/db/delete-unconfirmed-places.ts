import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Limpieza puntual (2026-09-07, ronda 4): verificación exhaustiva de los 102
// lugares del directorio de Planazo contra búsquedas web reales (dirección,
// reseñas, redes sociales, prensa) — 100/102 confirmados como negocios
// reales de CDMX. Solo 2 no se pudieron verificar:
// - "4 nuevos restaurantes en CDMX que debes conocer este fin de semana":
//   no es un lugar, es un artículo/listicle sin dirección — mismo bug de
//   categorización ya visto (noticia creada como `place`).
// - "Tláloc" (Gaming, Chihuahua 142, Roma Norte): sin ningún resultado real
//   de un negocio de videojuegos con ese nombre en esa dirección.
//
// Uso: pnpm db:delete-unconfirmed-places

const PLACE_IDS = [
  '3a7fd24f-eebb-48a2-b64d-263473b73c3c', // "4 nuevos restaurantes en CDMX que debes conocer este fin de semana"
  '58027c69-a08a-4a88-8c6b-3a57bca2a5ac', // "Tláloc" (Gaming)
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);

  await db.delete(schema.placeCategories).where(inArray(schema.placeCategories.placeId, PLACE_IDS));
  await db.delete(schema.placeTags).where(inArray(schema.placeTags.placeId, PLACE_IDS));
  await db.delete(schema.placeServices).where(inArray(schema.placeServices.placeId, PLACE_IDS));
  await db.delete(schema.photos).where(inArray(schema.photos.placeId, PLACE_IDS));
  await db.delete(schema.socialLinks).where(inArray(schema.socialLinks.placeId, PLACE_IDS));
  await db.delete(schema.openingHours).where(inArray(schema.openingHours.placeId, PLACE_IDS));

  const deleted = await db
    .delete(schema.places)
    .where(inArray(schema.places.id, PLACE_IDS))
    .returning({ id: schema.places.id, name: schema.places.name });

  console.log(`Borrados: ${deleted.length}/${PLACE_IDS.length}`);
  for (const p of deleted) console.log(`  - ${p.name}`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
