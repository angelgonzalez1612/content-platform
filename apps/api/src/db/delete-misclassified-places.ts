import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Limpieza puntual (2026-09-07, parte del plan de depuración para AdSense):
// la regla de automatización "Planazo — Qué busca la gente" (única sin
// restricción de contentTypes) clasificó 2 temas que en realidad NO son
// negocios/lugares como tipo `place` — quedaron sin dirección, teléfono ni
// coordenadas porque son noticia/listado, no una ficha de directorio:
// - "Revoca tribunal fallo del IECM que desechó queja contra Rojo de la Vega"
//   (nota política, sin ningún dato verificable de "lugar").
// - "CDMX 2026: Los lugares gratuitos que debes visitar antes del regreso a
//   clases" (artículo-listado, no un lugar individual).
// Ver PATCH a esa regla (contentTypes -> ['evento-planazo']) para evitar que
// se repita.
//
// Uso: pnpm db:delete-misclassified-places

const IDS = [
  '1da6f316-c641-4429-8b6f-88d1b8abfe7f', // Revoca tribunal fallo del IECM...
  '3b85fb02-5a1c-4bf5-8e53-8590a5666e6f', // CDMX 2026: Los lugares gratuitos...
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);

  // El onDelete:'cascade' del schema es solo intención de Drizzle — esta
  // conexión (@libsql/client) no tiene PRAGMA foreign_keys=ON, así que SQLite
  // no cascadea solo. Se limpia a mano antes de borrar las filas principales.
  await db.delete(schema.placeCategories).where(inArray(schema.placeCategories.placeId, IDS));
  await db.delete(schema.placeTags).where(inArray(schema.placeTags.placeId, IDS));
  await db.delete(schema.placeServices).where(inArray(schema.placeServices.placeId, IDS));
  await db.delete(schema.photos).where(inArray(schema.photos.placeId, IDS));
  await db.delete(schema.socialLinks).where(inArray(schema.socialLinks.placeId, IDS));
  await db.delete(schema.openingHours).where(inArray(schema.openingHours.placeId, IDS));

  const deleted = await db
    .delete(schema.places)
    .where(inArray(schema.places.id, IDS))
    .returning({ id: schema.places.id, name: schema.places.name });

  console.log(`Borrados: ${deleted.length}/${IDS.length}`);
  for (const p of deleted) console.log(`  - ${p.name}`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
