import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Corrección puntual (2026-09-10): este reportaje se publicó con su primer
// párrafo sin redactar de verdad — "Nota de ejemplo: aquí iría el análisis
// de cobertura hospitalaria por alcaldía con datos oficiales reales." quedó
// como texto placeholder en vez del contenido real. Se manda a in_review en
// vez de solo expandirlo: el segundo párrafo sí parece real, pero hace falta
// que un humano revise/reescriba el primero antes de que esto vuelva a
// publicarse — no es un problema de longitud, es un placeholder vivo.
//
// Uso: pnpm db:unpublish-hospital-reportaje

const REPORTAJE_ID = 'b023fa7b-aab6-4454-9697-934220612c55';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);

  const [updated] = await db
    .update(schema.reportajes)
    .set({ status: 'in_review' })
    .where(eq(schema.reportajes.id, REPORTAJE_ID))
    .returning({ id: schema.reportajes.id, title: schema.reportajes.title, status: schema.reportajes.status });

  console.log(updated ? `${updated.title} -> ${updated.status}` : 'No encontrado');

  await app.close();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
