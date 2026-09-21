import { Injectable, Inject } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE, type DrizzleDb } from '../../db/db.module';
import { aiSettings } from '../../db/schema';
import type { AiProviderId } from './provider-registry.service';

const SINGLETON_ID = 'singleton';

function maskKey(key: string): string {
  return key.length <= 4 ? '••••' : `••••${key.slice(-4)}`;
}

export interface AiSettingsStatus {
  openaiApiKeySet: boolean;
  openaiApiKeyPreview: string | null;
  preferredProvider: AiProviderId | null;
  fallbackProvider: AiProviderId | null;
}

@Injectable()
export class AiSettingsService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDb) {}

  /** Usado por OpenAiProvider — nunca sale de la API hacia el CMS. */
  async getOpenAiApiKey(): Promise<string | null> {
    const row = await this.db.query.aiSettings.findFirst({ where: eq(aiSettings.id, SINGLETON_ID) });
    return row?.openaiApiKey ?? null;
  }

  /** Usado por ProviderRegistry.generateWithFallback en cada llamada — se
   * re-resuelve siempre (barato, misma fila) para recoger cambios sin
   * reiniciar el proceso, igual que OpenAiProvider.getClient con la key. */
  async getProviderPreference(): Promise<{ preferredProvider: AiProviderId | null; fallbackProvider: AiProviderId | null }> {
    const row = await this.db.query.aiSettings.findFirst({ where: eq(aiSettings.id, SINGLETON_ID) });
    return {
      preferredProvider: (row?.preferredProvider as AiProviderId | null) ?? null,
      fallbackProvider: (row?.fallbackProvider as AiProviderId | null) ?? null,
    };
  }

  /** Para la pantalla de Configuración — nunca devuelve la key en claro. */
  async getStatus(): Promise<AiSettingsStatus> {
    const row = await this.db.query.aiSettings.findFirst({ where: eq(aiSettings.id, SINGLETON_ID) });
    const key = row?.openaiApiKey ?? null;
    return {
      openaiApiKeySet: !!key,
      openaiApiKeyPreview: key ? maskKey(key) : null,
      preferredProvider: (row?.preferredProvider as AiProviderId | null) ?? null,
      fallbackProvider: (row?.fallbackProvider as AiProviderId | null) ?? null,
    };
  }

  private async upsert(patch: { openaiApiKey?: string | null; preferredProvider?: AiProviderId | null; fallbackProvider?: AiProviderId | null }) {
    const existing = await this.db.query.aiSettings.findFirst({ where: eq(aiSettings.id, SINGLETON_ID) });
    if (existing) {
      await this.db.update(aiSettings).set({ ...patch, updatedAt: new Date() }).where(eq(aiSettings.id, SINGLETON_ID));
    } else {
      await this.db.insert(aiSettings).values({ id: SINGLETON_ID, ...patch, updatedAt: new Date() });
    }
    return this.getStatus();
  }

  async setOpenAiApiKey(key: string | null) {
    return this.upsert({ openaiApiKey: key });
  }

  async setProviderPreference(preferredProvider: AiProviderId | null, fallbackProvider: AiProviderId | null) {
    return this.upsert({ preferredProvider, fallbackProvider });
  }
}
