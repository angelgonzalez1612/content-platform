import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Segunda pasada de deduplicación (2026-09-07): la auditoría de round 1
// (dedupe-lamira-content.ts) usó una agrupación por "ancla" (compara cada
// candidato solo contra el primer item sin procesar), que dejó pasar
// duplicados donde una 3ª/4ª reescritura de la misma historia real ya no
// superaba el umbral de similitud contra el ancla original, aunque sí era
// obviamente la misma historia al leerla. Esta lista se armó re-auditando
// todo el contenido ya con comparación completa + verificación manual del
// contenido (no solo el título) para cada candidato ambiguo.
//
// Uso: pnpm db:dedupe-lamira-content-round2

const NOTICIA_IDS_TO_DELETE = [
  '5def17d3-776d-4ac9-be88-b9ed43c03bbb', // INE boletas — 4ª copia de la misma historia (ya se habían borrado 2 en round 1)
  '03172e26-c536-4153-bf57-f1e9560dc926', // Bellas Artes / música oaxaqueña — duplicado adicional
  '49463601-4f27-4b04-a834-f2b7e1207880', // Bellas Artes / música oaxaqueña — duplicado adicional
  'ca814f76-3700-4125-a6fa-51724f4c779b', // Mexico Tech Week — duplicado adicional
  '031119be-1565-4b63-b253-90c1b97a95d5', // Mexico Tech Week — duplicado adicional
  '3f9ff215-b8f8-445d-90a9-d4c54bfe70e5', // Mexico Tech Week — duplicado adicional
  'd933a05d-c105-419c-8e93-393b0a1a3405', // Mexico Tech Week — duplicado adicional
  '7789a676-6ccf-45be-bcc1-8086acf27ab6', // Trump aranceles aviones canadienses — duplicado (se queda la más antigua)
  'fa28c980-b6e0-4823-b6ae-b274dd034644', // Trump aranceles aviones canadienses — duplicado (se queda la más antigua)
  '9ff3f9a7-4e54-4d70-9454-8d4dbbe9af8b', // María Vargas Miss Universe — se encontró una copia más antigua, esta se retira
  '261e47b3-827a-4805-8b16-3168c0390f60', // NBA / Clippers — duplicado adicional
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
