import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { eq, isNull } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// La mayoría de las fotos de `places` nunca tuvieron `alt` (accesibilidad +
// el check bloqueante `imagen-con-alt`) — eso hace fallar el auto-publicado
// de prácticamente cualquier "Mejorar" sobre un lugar sin importar qué tan
// buena sea la redacción generada. Deterministico: el mismo patrón que ya
// usan las pocas fotos que SÍ tienen alt (alt = nombre del lugar tal cual,
// ver Museo Soumaya / Museo Nacional de Arte).
//
// Uso: pnpm db:backfill-photo-alt

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);

  const rows = await db.query.photos.findMany({ where: isNull(schema.photos.alt), with: { place: true } });
  console.log(`${rows.length} fotos sin alt.`);

  let updated = 0;
  for (const photo of rows) {
    if (!photo.place?.name) {
      console.log(`SIN LUGAR | foto ${photo.id} (place_id=${photo.placeId}) — no se pudo resolver el nombre, se deja intacta.`);
      continue;
    }
    await db.update(schema.photos).set({ alt: photo.place.name }).where(eq(schema.photos.id, photo.id));
    updated += 1;
  }

  console.log(`\nTotal: ${updated}/${rows.length} fotos actualizadas.`);
  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
