import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Limpieza puntual (2026-09-07, ronda 5): el usuario vio en vivo en
// localhost:3003 eventos de Planazo cuya imagen no correspondía o eran muy
// cortos. Al revisar, 3 de los 5 "eventos" resultaron ser noticias/civic-news
// mal categorizadas (mismo bug ya visto varias veces hoy — evento-planazo
// exige angle de "recomendación de plan", no cobertura noticiosa, ver
// classifyHint en content-types.ts), con imágenes rotas o irrelevantes:
// - "2449: En la alcaldía Miguel Hidalgo, policías..." — URL de imagen
//   malformada (con "/" de más antes de "https://", nunca cargaría).
// - "Supervisa Brugada cuatro obras hidráulicas en Contreras" — sin imagen.
// - "Miguel Angel Velázquez: Ciudad perdida" (borrador) — la "imagen" es un
//   archivo .djvu de Wikimedia Commons (documento escaneado, no una foto).
// - "Mayor demanda impulsa renovación y expansión de Ecobici en CDMX" —
//   noticia real y con imagen real, pero sigue siendo cobertura noticiosa
//   sin fecha/lugar real de evento, no una recomendación de plan.
// Solo "Taller de mezcal en Coyoacán" (con fecha real) se queda.
//
// Uso: pnpm db:delete-bad-events

const EVENT_IDS = [
  '258fa4d1-4886-41b1-9ad0-40b4d59da6c5', // policías / labor de parto
  'b2c4b172-7306-4d53-b83a-06954c07dbdf', // Brugada obras hidráulicas
  '47b71ad4-30fa-4f49-a25e-a71c3d13b4a7', // Ciudad perdida (imagen .djvu)
  '60428c49-a89d-431f-90ca-37a4ef8740fb', // Ecobici
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
