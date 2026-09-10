import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Corrección puntual (2026-09-10): 3 noticias tenían contenido real y de
// buena longitud, pero su `seo.description` original (de cuando se
// publicaron, antes de que este check aplicara en el flujo de "mejorar")
// se pasaba por 2-4 caracteres del límite de 160 — eso bloqueaba
// expand-short-lamira-content.ts de guardar el cuerpo expandido, aunque el
// cuerpo en sí ya no tuviera ningún problema. Se recorta a mano, sin tocar
// ningún hecho.
//
// Uso: pnpm db:fix-seo-length-round1

const FIXES: { id: string; description: string }[] = [
  {
    id: '19106f20-a664-4402-ad94-efa473b5610e', // María Vargas, Miss Universe México
    description:
      'María Vargas, coronada Miss Universe México 2026, concedió una entrevista a Telemundo sobre su camino hacia el título y sus planes con la corona.',
  },
  {
    id: '3ade448b-bb90-4ec0-b8c0-a3226f41bf8d', // Cinerent Premium
    description:
      "El canal Cinerent Premium publicó 'Welcome al Norte' para anunciar nuevos títulos disponibles en renta, con la lista completa en la descripción.",
  },
  {
    id: '091feb8b-aebb-4bb0-9e92-11edd6571fff', // Infonavit
    description:
      'El director del Infonavit, exdirector de Pemex, no ha hecho pública información sobre su sueldo, inmuebles ni cuentas, a diferencia de otros funcionarios.',
  },
];

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);

  for (const fix of FIXES) {
    if (fix.description.length < 120 || fix.description.length > 160) {
      throw new Error(`"${fix.id}": ${fix.description.length} caracteres, fuera de 120-160 — revisa el texto antes de guardar.`);
    }
    const row = await db.query.noticias.findFirst({ where: eq(schema.noticias.id, fix.id) });
    if (!row) { console.log(`SIN FILA | ${fix.id}`); continue; }
    const seo = { ...(row.seo as { title?: string; description?: string }), description: fix.description };
    await db.update(schema.noticias).set({ seo }).where(eq(schema.noticias.id, fix.id));
    console.log(`OK (${fix.description.length}c) | ${row.title}`);
  }

  await app.close();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
