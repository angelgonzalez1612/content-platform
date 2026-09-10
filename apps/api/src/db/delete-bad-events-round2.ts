import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Limpieza puntual (2026-09-10, ronda 2 — ver delete-bad-events.ts para la
// ronda 1): el @Interval de 15 min de AutomationRunnerService, corriendo con
// la API local levantada durante esta sesión de depuración, publicó 2
// "eventos" más con el MISMO bug de categorización que la ronda 1 — cobertura
// noticiosa (estudio de mercado de gaming, ranking turístico) sin
// startDate/locationName reales, no una recomendación de plan con fecha y
// lugar. Confirma que la regla de origen sigue activa pese a los PATCHes
// documentados en rondas anteriores — necesita arreglo de código aparte,
// esto solo limpia lo ya publicado.
//
// Uso: pnpm db:delete-bad-events-round2

const EVENT_IDS = [
  '0c3142b1-0b2d-4945-addc-0ac42ede2e01', // Smartphones impulsan el gaming en México...
  'cd04cf1b-988d-41ee-bc4d-0d64004c86ed', // México lidera crecimiento turístico...
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
