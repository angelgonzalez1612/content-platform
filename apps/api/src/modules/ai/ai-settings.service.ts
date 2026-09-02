import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { aiSettings } from '../../db/schema';

const SINGLETON_ID = 'singleton';

function maskKey(key: string): string {
  return key.length <= 4 ? '••••' : `••••${key.slice(-4)}`;
}

@Injectable()
export class AiSettingsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /** Usado por OpenAiProvider — nunca sale de la API hacia el CMS. */
  async getOpenAiApiKey(): Promise<string | null> {
    const row = await this.db.query.aiSettings.findFirst({ where: eq(aiSettings.id, SINGLETON_ID) });
    return row?.openaiApiKey ?? null;
  }

  /** Para la pantalla de Configuración — nunca devuelve la key en claro. */
  async getStatus(): Promise<{ openaiApiKeySet: boolean; openaiApiKeyPreview: string | null }> {
    const key = await this.getOpenAiApiKey();
    return { openaiApiKeySet: !!key, openaiApiKeyPreview: key ? maskKey(key) : null };
  }

  async setOpenAiApiKey(key: string | null) {
    const existing = await this.db.query.aiSettings.findFirst({ where: eq(aiSettings.id, SINGLETON_ID) });
    if (existing) {
      await this.db.update(aiSettings).set({ openaiApiKey: key, updatedAt: new Date() }).where(eq(aiSettings.id, SINGLETON_ID));
    } else {
      await this.db.insert(aiSettings).values({ id: SINGLETON_ID, openaiApiKey: key, updatedAt: new Date() });
    }
    return this.getStatus();
  }
}
