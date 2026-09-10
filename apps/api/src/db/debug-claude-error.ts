import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { AppModule } from '../app.module';
import { AiDraftService } from '../modules/ai/ai-draft.service';
import { DRIZZLE, type DrizzleDb } from './db.module';
import * as schema from './schema';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  const db = app.get<DrizzleDb>(DRIZZLE);
  const aiDraft = app.get(AiDraftService);

  const place = await db.query.places.findFirst({ where: eq(schema.places.name, 'Café Nin') });
  if (!place) {
    console.log('no encontrado');
    await app.close();
    return;
  }

  try {
    const result = await aiDraft.improveContent('place', place.id, {
      mode: 'rewrite',
      instructions: 'Expándela a 80-120 palabras.',
      provider: 'claude-cli',
    });
    console.log('OK:', JSON.stringify(result).slice(0, 500));
  } catch (err) {
    console.log('FULL ERROR MESSAGE:');
    console.log((err as Error).message);
    console.log('\nSTACK:');
    console.log((err as Error).stack);
  }

  await app.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
