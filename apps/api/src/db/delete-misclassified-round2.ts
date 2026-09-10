import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { eq, inArray } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Limpieza puntual (2026-09-07, ronda 2): 2 piezas más del mismo bug de
// categorización — noticias/listados creados como place/evento-planazo sin
// ningún dato verificable. Se crearon MIENTRAS las 12 reglas de Planazo
// tenían categorySlugs/contentTypes vacíos por el bug de Zod .partial()
// (ver automation-rule.dto.ts) — ya corregido, ya no debería repetirse.
//
// Uso: pnpm db:delete-misclassified-round2

const PLACE_ID = '75a0a0af-b104-47c9-825d-d475a04ffc75'; // "Restaurantes trendy en CDMX a los que sí queremos regresar"
const EVENT_ID = 'e22f5728-917f-43e3-a750-c0634c98bdaf'; // "Se consolida Morena en la Ciudad de México como principal fuerza política"

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);

  await db.delete(schema.placeCategories).where(eq(schema.placeCategories.placeId, PLACE_ID));
  await db.delete(schema.placeTags).where(eq(schema.placeTags.placeId, PLACE_ID));
  await db.delete(schema.placeServices).where(eq(schema.placeServices.placeId, PLACE_ID));
  await db.delete(schema.photos).where(eq(schema.photos.placeId, PLACE_ID));
  await db.delete(schema.socialLinks).where(eq(schema.socialLinks.placeId, PLACE_ID));
  await db.delete(schema.openingHours).where(eq(schema.openingHours.placeId, PLACE_ID));

  const deletedPlace = await db
    .delete(schema.places)
    .where(inArray(schema.places.id, [PLACE_ID]))
    .returning({ id: schema.places.id, name: schema.places.name });
  console.log(deletedPlace.length ? `Place borrado: ${deletedPlace[0].name}` : 'Place no encontrado');

  const deletedEvent = await db
    .delete(schema.events)
    .where(inArray(schema.events.id, [EVENT_ID]))
    .returning({ id: schema.events.id, name: schema.events.name });
  console.log(deletedEvent.length ? `Event borrado: ${deletedEvent[0].name}` : 'Event no encontrado');

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
