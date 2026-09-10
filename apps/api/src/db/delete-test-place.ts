import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Limpieza puntual (2026-09-07): "Fonda Fase 4 Test" — lugar creado el
// 2026-08-25 durante las pruebas de la Fase 4 del CMS, quedó marcado
// `published` en vez de borrarse al terminar esa sesión. Único ítem de
// prueba real encontrado tras revisar noticias/alertas/guías/eventos/
// lugares/reportajes de La Mira y places/events de Planazo.
//
// Uso: pnpm db:delete-test-place

const ID = 'cd219acf-a15d-4066-be4e-8c4de257f106';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);

  // El onDelete:'cascade' del schema es solo intención de Drizzle — esta
  // conexión (@libsql/client) no tiene PRAGMA foreign_keys=ON, así que SQLite
  // no cascadea solo. Se limpia a mano antes de borrar la fila principal.
  await db.delete(schema.placeCategories).where(eq(schema.placeCategories.placeId, ID));
  await db.delete(schema.placeTags).where(eq(schema.placeTags.placeId, ID));
  await db.delete(schema.placeServices).where(eq(schema.placeServices.placeId, ID));
  await db.delete(schema.photos).where(eq(schema.photos.placeId, ID));
  await db.delete(schema.socialLinks).where(eq(schema.socialLinks.placeId, ID));
  await db.delete(schema.openingHours).where(eq(schema.openingHours.placeId, ID));

  const deleted = await db
    .delete(schema.places)
    .where(eq(schema.places.id, ID))
    .returning({ id: schema.places.id, name: schema.places.name });
  console.log(deleted.length ? `Borrado: ${deleted[0].name}` : 'No se encontró (¿ya se había borrado?)');

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
