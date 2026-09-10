import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Tercera pasada de deduplicación (2026-09-10). audit-content-quality.ts
// encontró 4 grupos de posibles duplicados en noticias y 3 en alertas — de
// los 7, solo 3 se verificaron a mano (fecha de creación + contenido, no
// solo título) como la MISMA historia real:
// - "Museos gratuitos que puedes visitar en la Ciudad de México" (34
//   palabras, Aug 25) vs "De la Piedra del Sol a la Casa Azul: diez museos
//   para entender la Ciudad de México" (350 palabras, Sep 4) — mismo tema
//   evergreen, se queda la versión completa; la corta también falló su
//   expansión por IA (ver expand-short-lamira-content.ts, error de parseo).
// - Las dos piezas de "agenda de septiembre" creadas con 4 minutos de
//   diferencia el mismo automation run (2026-09-07 12:18/12:22) — se queda
//   la más larga (582w).
// - Las dos piezas de "Grito de Independencia 2026 / cartelera musical"
//   creadas un día aparte — se queda la más larga y más reciente (619w).
//
// Los otros 4 grupos que marcó el audit (Metro CDMX x3, protestas x2, lluvia
// x2, agenda-24-28-agosto vs vialidades-28-agosto) se revisaron y NO se
// tocan: son notas de fechas distintas sobre ángulos genuinamente distintos
// del mismo tema recurrente (metro, protestas, lluvia son temas semanales en
// CDMX) — el detector de similitud por palabras del título da falso positivo
// ahí porque comparte solo "Metro CDMX"/"protestas"/"lluvia", no la historia.
//
// Uso: pnpm db:dedupe-lamira-round3

const NOTICIA_IDS_TO_DELETE = [
  '4aaf9754-4649-49cf-a765-7d8dc6bca787', // Museos gratuitos... (34w, se queda 82482d18)
  '78cd7f49-49d4-4143-bbbd-8b97b346f43b', // Elote, pan dulce y el Grito... (se queda 07cc86d3, 582w)
  '188e89b9-b96b-42a9-872e-2e59154d3948', // Grito de Independencia 2026: la cartelera musical... (se queda 60fec181, 619w)
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);

  const deleted = await db
    .delete(schema.noticias)
    .where(inArray(schema.noticias.id, NOTICIA_IDS_TO_DELETE))
    .returning({ id: schema.noticias.id, title: schema.noticias.title });

  console.log(`Noticias borradas: ${deleted.length}/${NOTICIA_IDS_TO_DELETE.length}`);
  for (const n of deleted) console.log(`  - ${n.title}`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
