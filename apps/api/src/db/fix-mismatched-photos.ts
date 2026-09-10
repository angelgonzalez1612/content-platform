import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Segunda pasada de limpieza de fotos (2026-09-07): fix-place-photos.ts
// reemplazó fotos falsas por el primer resultado de ImageSearchService sin
// verificar visualmente si de verdad correspondía al lugar — una búsqueda
// por palabras clave puede devolver algo "parecido" pero incorrecto. Se
// revisaron a mano (descargando y viendo) las 14 fotos reemplazadas; 5
// resultaron ser fotos de OTRA cosa (una foto de ópera para el Museo Frida
// Kahlo, un retrato colonial para el Museo de Antropología, un hombre
// leyendo poesía para "Café C", arte de video para "Plaza de la
// Tecnología", gente en un evento para "Museo del Estanquillo" — ninguna
// muestra el lugar real). Para 2 se encontró la foto correcta real
// (fachada/entrada verificada); para las otras 3 no hay ninguna foto real
// disponible en Wikimedia/Openverse — se quitan (mejor sin foto que una
// que muestra otra cosa).
//
// Uso: pnpm db:fix-mismatched-photos

const CORRECTIONS: { placeId: string; url: string; credit: string }[] = [
  {
    placeId: '4cae02f8-338a-4d4e-ad7c-72e710835f27', // Museo Frida Kahlo (Casa Azul)
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/9b/Fachada_Museo_Frida_Kahlo.jpg',
    credit: 'Leonardo DPB · CC BY-SA 4.0 (Wikimedia Commons)',
  },
  {
    placeId: 'f94dfacf-61dd-4cb2-8b5e-c88e1c3f2d49', // Museo Nacional de Antropología
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a2/Museo_Nacional_de_Antropolog%C3%ADa%2C_Mexico_DF%2C_Marzo_1974_-_Outside.jpg',
    credit: 'Family photos of Infrogmation · CC BY-SA 4.0 (Wikimedia Commons)',
  },
];

const REMOVE_PHOTOS_FOR = [
  '67d0d385-6ffa-414a-b633-420cb65fa7bd', // Café C — sin foto real encontrada
  'b6e160df-c698-4914-a07a-802cfc1aafa1', // Plaza de la Tecnología — sin foto real encontrada
  'dad3f689-810d-4984-b443-be83e20f35d7', // Museo del Estanquillo — solo hay fotos de eventos, no del lugar
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);

  for (const fix of CORRECTIONS) {
    const rows = await db.query.photos.findMany({ where: eq(schema.photos.placeId, fix.placeId) });
    for (const row of rows) {
      await db.update(schema.photos).set({ url: fix.url, credit: fix.credit }).where(eq(schema.photos.id, row.id));
    }
    console.log(`CORREGIDA (${rows.length} foto(s)) | placeId ${fix.placeId} -> ${fix.url}`);
  }

  for (const placeId of REMOVE_PHOTOS_FOR) {
    const deleted = await db.delete(schema.photos).where(eq(schema.photos.placeId, placeId)).returning({ id: schema.photos.id });
    console.log(`QUITADAS (${deleted.length} foto(s)) | placeId ${placeId}`);
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
