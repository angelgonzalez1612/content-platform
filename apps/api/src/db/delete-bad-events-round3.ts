import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Limpieza puntual (2026-09-17, ronda 3 — ver delete-bad-events.ts y
// delete-bad-events-round2.ts para las rondas anteriores): Google Search
// Console reportó "Falta el campo startDate" (crítico) en datos estructurados
// de Eventos de planazo.com.mx. Mismo bug recurrente: la automatización creó
// 4 "eventos" que en realidad son cobertura noticiosa/entretenimiento
// (reprogramación de concierto, noticias de tiendas/streaming), sin fecha ni
// lugar real de evento — evento-planazo exige angle de "recomendación de
// plan", no noticia (ver classifyHint en content-types.ts). Ninguno tenía
// startDate ni location real, confirmado vía GET /api/events antes de borrar.
//
// Uso: pnpm db:delete-bad-events-round3

const EVENT_IDS = [
  '95d7985d-a789-4ac3-ad92-c20f5d5447b2', // Reprograman concierto de Ed Sheeran...
  '6620a806-eb03-4280-a9c4-a964c8340396', // Bandai Namco expande tiendas...
  'f25e7c14-7232-4056-9eaf-6c760419d259', // HBO Max confirma estreno...
  'b4a68794-9153-4c97-b2e0-e8a570739c02', // Estrenos de Netflix septiembre 2026...
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);

  const deleted = await db
    .delete(schema.events)
    .where(inArray(schema.events.id, EVENT_IDS))
    .returning({ id: schema.events.id, name: schema.events.name });

  console.log(`Borrados: ${deleted.length}/${EVENT_IDS.length}`);
  for (const e of deleted) console.log(`  - ${e.name}`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
