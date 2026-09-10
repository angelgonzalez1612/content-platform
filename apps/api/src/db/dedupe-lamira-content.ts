import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Limpieza puntual (2026-09-07): la automatización, antes del fix de
// deduplicación por similitud en automation-runner.service.ts, publicó la
// misma noticia real varias veces cuando Content Radar la traía citada por
// 2-4 medios distintos con encabezados distintos (Scorpions, INE, Metro
// CDMX, etc.). Esta lista se armó a mano, leyendo el título Y el cuerpo de
// cada candidato a duplicado antes de incluirlo — el heurístico de similitud
// de títulos (ver find_dupes.py, no incluido en el repo) tuvo varios falsos
// positivos reales (ej. "Museos gratuitos..." vs "De la Piedra del Sol...",
// dos artículos distintos que solo comparten vocabulario de museos) que se
// excluyeron a mano tras leer el contenido completo. NO correr de nuevo con
// otra lista sin la misma verificación manual.
//
// Uso: pnpm db:dedupe-lamira-content

const NOTICIA_IDS_TO_DELETE = [
  '76789b5c-8f86-48d3-a789-6b0ff5a42318', // Talent Land México — duplicado
  '4c849b8b-100d-4991-9827-a9aeebfbb174', // NBA / Clippers — duplicado
  'f11d455c-71e4-4523-877b-89f15e628f8e', // Sheinbaum / Morena — duplicado
  '09b14da4-357a-454c-8fda-09b1b43bdb75', // Miss Universe México — duplicado
  'b1e75e88-ee1c-4fe8-b91e-c482f555eeb6', // Mexico Tech Week — duplicado
  'a36ead00-9281-4de5-9ab2-101a4404ca02', // El Cervantino — duplicado
  '527da35d-15cd-4c31-b10d-f22ce6b562de', // El Cervantino — duplicado
  '72e28c80-8a74-4735-aa61-8b49aa76c91c', // El Cervantino — duplicado
  'c1689b4a-fcf6-4457-acbf-e3a646ea0a05', // Bombardeo a La Moneda — duplicado
  'f5aa1adc-83f4-41ae-956b-faad2abd5e1e', // Bellas Artes / música oaxaqueña — duplicado
  'cc1bb022-f70c-4c90-b520-0fd0973264b5', // Noche de Museos — duplicado
  '22a81797-cfb3-43fb-b719-a340dde28a7e', // Noche de Museos — duplicado
  '3f5d6eaf-24c9-418d-bbba-66b18419fa9f', // INE boletas planchadas — duplicado
  '4d86d9ac-8515-446f-8264-9a6d87c4ac14', // INE boletas planchadas — duplicado
  '2357007c-5e61-413c-89ed-214307abcbe4', // Premios Juventud — duplicado
  '169213d7-97ee-4744-b7ce-c782906b7582', // Canal YouTube "Welcome al Norte" — duplicado
  'fd558179-7bcc-4b90-b360-599f8f54dc29', // Seahawks fichaje — duplicado
  'e08e614e-61be-42d9-9f0d-5591b12c4198', // Scorpions cancela gira — duplicado
  '1ae5ccc7-9ce9-476f-8158-ce525120cac1', // Scorpions cancela gira — duplicado
  '2d5fb3bb-52e6-4b9a-85ec-f17e322981ec', // Scorpions cancela gira — duplicado
  '3b489f6e-adcb-43a1-a590-16e2aa8c41e7', // Metro 57 años (concierto) — duplicado
];

const ALERTA_IDS_TO_DELETE = [
  '0e68e9ea-b75d-4d1b-b3ff-c3ebf8fb802e', // Lluvia Cuauhtémoc / Metro marcha lenta — duplicado
  '580034b7-a31c-4f6f-8155-158e0acf7da9', // Lluvia Cuauhtémoc / Metro marcha lenta — duplicado
  'bb142068-7aff-4e54-9e67-30ae45dd438b', // Lluvia Cuauhtémoc / Metro marcha lenta — duplicado
  '77b854bb-bf6a-486d-acb2-bb2807c61d7d', // Cierre 4 estaciones Línea 2 (mantenimiento) — duplicado
  '7d6711ad-ecfd-4d6c-b08f-411072f4036b', // Cierre 4 estaciones Línea 2 (mantenimiento) — duplicado
  '0057ec34-1b71-4abe-9507-326e92b72afb', // Línea 2 dividida en tramos — duplicado
  '7f0f839b-6843-4eec-8510-8cab63d502d3', // Línea 2 dividida en tramos — duplicado
  'fd196df0-2e2e-4c23-9a6e-406663160e0d', // Sindicato del Metro / marcha — duplicado
  'dcb58d97-ba8f-4c7c-a1db-3cc520929cde', // Desalojo Vidal Alcocer — duplicado
  'c795eb23-8be7-4ea7-b13e-2a2ec126bdc5', // Desalojo Vidal Alcocer — duplicado
  '8fcdfbf2-d860-43a6-bc02-e192489d71b9', // Desalojo Vidal Alcocer — duplicado
  '89434093-37eb-412b-affd-4f3cd5b6df14', // Bloqueos viernes seis alcaldías — duplicado
  '4c7b4488-2c26-4e64-ae98-0b016f031679', // Cierres por movilizaciones — duplicado
  '244a0e93-8a98-46ad-9216-9260613127e6', // Marcha lenta Líneas 2 y 7 — duplicado
  'ad57314a-2d50-4d15-9d38-abfb18ff173d', // Metro 57 años (conductores) — duplicado
  '13b46ef2-2667-4d87-a835-f4dd505f386d', // Robo cuentas WhatsApp — duplicado
  '8be5aa60-d023-4bac-ad00-dec263d0a60e', // Robo cuentas WhatsApp — duplicado
  '95cea554-ce47-4275-b2f0-aaf3e2c6a5cc', // Robo cuentas WhatsApp — duplicado
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);

  const deletedNoticias = await db
    .delete(schema.noticias)
    .where(inArray(schema.noticias.id, NOTICIA_IDS_TO_DELETE))
    .returning({ id: schema.noticias.id, title: schema.noticias.title });
  console.log(`Noticias borradas: ${deletedNoticias.length}/${NOTICIA_IDS_TO_DELETE.length}`);
  for (const n of deletedNoticias) console.log(`  - ${n.title}`);

  const deletedAlertas = await db
    .delete(schema.alertas)
    .where(inArray(schema.alertas.id, ALERTA_IDS_TO_DELETE))
    .returning({ id: schema.alertas.id, title: schema.alertas.title });
  console.log(`\nAlertas borradas: ${deletedAlertas.length}/${ALERTA_IDS_TO_DELETE.length}`);
  for (const a of deletedAlertas) console.log(`  - ${a.title}`);

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
