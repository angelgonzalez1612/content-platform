import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// fix-place-photos.ts y fix-mismatched-photos.ts reescribían TODAS las filas
// de foto existentes de un lugar con el mismo resultado (misma URL), en vez
// de una fila o resultados distintos por fila — un lugar con 3 fotos falsas
// terminó con la misma foto real repetida 3 veces. Esto colapsa cada grupo
// (placeId, url) duplicado a una sola fila (se queda la de menor `position`,
// y ante empate la más antigua por `createdAt`), sin tocar lugares que ya
// tienen varias fotos genuinamente distintas.
//
// Uso: pnpm db:dedupe-place-photos

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);

  const allPhotos = await db.query.photos.findMany();

  const groups = new Map<string, typeof allPhotos>();
  for (const photo of allPhotos) {
    const key = `${photo.placeId}::${photo.url}`;
    const group = groups.get(key);
    if (group) group.push(photo);
    else groups.set(key, [photo]);
  }

  const idsToDelete: string[] = [];
  let groupsAffected = 0;

  for (const [key, rows] of groups) {
    if (rows.length <= 1) continue;
    groupsAffected += 1;
    const sorted = [...rows].sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position;
      return a.createdAt.getTime() - b.createdAt.getTime();
    });
    const [keep, ...drop] = sorted;
    idsToDelete.push(...drop.map((p) => p.id));
    console.log(
      `DUPLICADA | ${key} | se queda ${keep.id} (position ${keep.position}), se borran ${drop.map((p) => p.id).join(', ')}`,
    );
  }

  if (idsToDelete.length > 0) {
    await db.delete(schema.photos).where(inArray(schema.photos.id, idsToDelete));
  }

  console.log(
    `\nTotal: ${groupsAffected} lugares con foto duplicada, ${idsToDelete.length} filas borradas.`,
  );

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
