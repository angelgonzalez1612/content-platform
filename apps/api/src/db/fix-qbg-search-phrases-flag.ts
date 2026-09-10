import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

// Corrección puntual (2026-09-10): reactivate-que-busca-la-gente.ts solo tocó
// `active`/`contentTypes` al reactivar la regla — `includeSearchPhrases` se
// quedó en `false` (como estaba desde antes de la desactivación original),
// así que la regla nunca iba a considerar ninguna frase real de "qué busca
// la gente" pese al nombre: getQueueStatus()/run() exigen
// `rule.includeSearchPhrases` explícito para un topic con source
// 'search-phrase' (ver ruleCouldMatch + el `&&` extra en ambos), no basta con
// `active:true` + contentTypes correctos. Esto es lo que de verdad faltaba
// para que la regla haga lo que su nombre promete.
//
// Uso: pnpm db:fix-qbg-search-phrases-flag

const RULE_ID = '40427521-493e-4523-94a1-b28eb11349ad';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);

  const [updated] = await db
    .update(schema.automationRules)
    .set({ includeSearchPhrases: true })
    .where(eq(schema.automationRules.id, RULE_ID))
    .returning({ id: schema.automationRules.id, name: schema.automationRules.name, includeSearchPhrases: schema.automationRules.includeSearchPhrases });

  console.log(updated ? JSON.stringify(updated, null, 2) : 'Regla no encontrada');

  await app.close();
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
