import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { inArray } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import { ImageSearchService } from '../modules/ai/image-search.service';
import * as schema from './schema';

// Parte del plan de depuración para AdSense (2026-09-07, ronda 2): 9 lugares
// se quedaron sin ninguna foto tras la limpieza de fotos falsas (round 1).
// Busca con ImageSearchService (Wikimedia Commons + Openverse, licencias
// comerciales) — igual que fix-place-photos.ts, pero esta vez SOLO REPORTA,
// no aplica nada solo: los nombres son negocios pequeños/genéricos con alta
// probabilidad de falso-positivo (ver caso "Museo Frida Kahlo" con foto de
// ópera en la ronda 1) — cada candidato encontrado se revisa a mano antes
// de aplicarlo con fix-mismatched-photos.ts o similar.
//
// Uso: pnpm db:find-photos-for-places

const PLACE_IDS = [
  '9bce2c25-c0cf-4e76-b1ac-199bcbba007e', // Jardín Botánico
  'a29ab1ef-a1c7-4a5b-bc9a-9714dee4362d', // The Limited Company Geek Store — Coyoacán
  '4efab947-92cd-4129-8687-841269dd6b56', // Marea Alta
  '76af3289-9279-44c1-b529-abf42659904b', // Nudo Panadería & Cava
  'ff7e37bb-ccf8-4684-b6cf-eb463b488c5e', // Café Tostado Lento
  '3e762ddc-7f63-465f-ac12-d7e7fd99553e', // Taller de mezcal y maíz
  '79526034-4882-4f15-82ae-36ac86e57ba6', // Terraza Mirador 24
  '58b70beb-0008-4a89-b7e7-09ab47eac500', // Centro Cultural Digital
  '0d736504-b5c7-4f0d-8a6b-452c21527076', // LAN Center Retro
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);
  const imageSearch = app.get(ImageSearchService);

  const places = await db.query.places.findMany({
    where: inArray(schema.places.id, PLACE_IDS),
    with: { placeCategories: { with: { category: true } } },
  });

  for (const place of places) {
    const categoryName = place.placeCategories[0]?.category?.name ?? '';
    const query = `${place.name} ${categoryName} CDMX`.trim();
    const results = await imageSearch.search(query);
    if (results.length === 0) {
      console.log(`SIN RESULTADO | ${place.name} | id=${place.id}`);
    } else {
      console.log(`CANDIDATO | ${place.name} | id=${place.id}`);
      for (const r of results.slice(0, 3)) {
        console.log(`   ${r.url} | ${r.credit}`);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
