import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Limpieza puntual (2026-09-07, ronda 3): 8 lugares con createdAt idéntico
// al segundo (2026-08-25T19:01:49) — un día ANTES de la migración real del
// mock de Planazo (2026-08-26T15:40, ~92 lugares en lote) y con el mismo
// patrón exacto que "Fonda Fase 4 Test" (ya borrado). Nunca tuvieron foto
// real encontrable ni datos verificables, y sus descripciones originales
// eran de 9-14 palabras — consistente con datos de prueba de CRUD de una
// sesión de desarrollo del CMS, no negocios reales.
//
// Uso: pnpm db:delete-old-test-places

const PLACE_IDS = [
  '0d736504-b5c7-4f0d-8a6b-452c21527076', // LAN Center Retro
  '58b70beb-0008-4a89-b7e7-09ab47eac500', // Centro Cultural Digital
  '9bce2c25-c0cf-4e76-b1ac-199bcbba007e', // Jardín Botánico
  '79526034-4882-4f15-82ae-36ac86e57ba6', // Terraza Mirador 24
  '76af3289-9279-44c1-b529-abf42659904b', // Nudo Panadería & Cava
  'ff7e37bb-ccf8-4684-b6cf-eb463b488c5e', // Café Tostado Lento
  '3e762ddc-7f63-465f-ac12-d7e7fd99553e', // Taller de mezcal y maíz
  '1aa6e343-cbea-4bbb-b497-acd0c9dbc23b', // Museo Tamayo: nueva sala
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
