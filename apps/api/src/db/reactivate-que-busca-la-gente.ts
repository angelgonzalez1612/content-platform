import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Reactivación (2026-09-10): la regla "Planazo — Qué busca la gente" se
// desactivó por generar evento-planazo mal clasificado a partir de temas de
// búsqueda amplia ("qué hacer en CDMX", listas de museos, etc.) — el objetivo
// real de la regla (contenido para lo que la gente busca en Google, no solo
// noticia caliente) era correcto, solo estaba apuntada al tipo de contenido
// equivocado. Ahora que existe 'planazo-guia' como tipo automatizable (ver
// content-types.ts + createContent en automation-runner.service.ts), se
// reactiva apuntando ahí — sigue sin restricción de categorySlugs (cualquier
// tema de búsqueda amplia puede volverse una guía), y toda guía generada
// pasa por revisión humana sin excepción (ver checks.service.ts).
//
// Uso: pnpm db:reactivate-que-busca-la-gente

const RULE_ID = '40427521-493e-4523-94a1-b28eb11349ad';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);

  const [updated] = await db
    .update(schema.automationRules)
    .set({ active: true, contentTypes: ['planazo-guia'] })
    .where(eq(schema.automationRules.id, RULE_ID))
    .returning({ id: schema.automationRules.id, name: schema.automationRules.name, active: schema.automationRules.active, contentTypes: schema.automationRules.contentTypes });

  console.log(updated ? JSON.stringify(updated, null, 2) : 'Regla no encontrada');

  await app.close();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
