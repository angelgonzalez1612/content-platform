import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import type { ContentProvider, StructuredGenerateInput } from './content-provider.interface';
import { OpenAiProvider } from './providers/openai-provider';
import { ClaudeCliProvider } from './providers/claude-cli-provider';
import { CodexCliProvider } from './providers/codex-cli-provider';
import { AiSettingsService } from './ai-settings.service';

export const AI_PROVIDER_IDS = ['openai', 'claude-cli', 'codex-cli'] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

const PROVIDER_LABEL: Record<AiProviderId, string> = {
  openai: 'OpenAI',
  'claude-cli': 'Claude',
  'codex-cli': 'Codex',
};

// Elegible por request (draftRequestSchema.provider / improveRequestSchema.provider)
// en vez de un único CONTENT_PROVIDER inyectado — openai da salida
// estructurada garantizada y cuesta por token; claude-cli y codex-cli usan
// la sesión ya autenticada en esta máquina (suscripción Pro/Max de Claude,
// o de ChatGPT vía `codex login`) en vez de una API key nueva de pago por
// token, pero sin esa garantía de formato — cada uno valida+reintenta en su
// lugar (codex-cli sí puede pedirle al CLI un JSON Schema real, ver
// codex-cli-provider.ts; claude-cli solo puede describirlo en el prompt).
@Injectable()
export class ProviderRegistry {
  constructor(
    private readonly openAiProvider: OpenAiProvider,
    private readonly claudeCliProvider: ClaudeCliProvider,
    private readonly codexCliProvider: CodexCliProvider,
    private readonly aiSettings: AiSettingsService,
  ) {}

  get(id: AiProviderId): ContentProvider {
    if (id === 'claude-cli') return this.claudeCliProvider;
    if (id === 'codex-cli') return this.codexCliProvider;
    return this.openAiProvider;
  }

  /** Punto único que usan AiDraftService/BlockImproveService/SeoGenerateService
   * en vez de `get(id).generateStructured(...)` directo — si `id` es el
   * proveedor preferido configurado en Configuración y falla (CLI sin
   * sesión, límite alcanzado, timeout, lo que sea), reintenta UNA vez con el
   * de respaldo antes de fallar la generación completa. Sin preferencia
   * configurada, o pidiendo un proveedor que no es el preferido, se comporta
   * exactamente como antes (sin reintento — la elección explícita del
   * llamador manda). */
  async generateWithFallback<Schema extends z.ZodTypeAny>(
    id: AiProviderId,
    input: StructuredGenerateInput<Schema>,
  ): Promise<z.infer<Schema>> {
    try {
      return await this.get(id).generateStructured(input);
    } catch (err) {
      const { preferredProvider, fallbackProvider } = await this.aiSettings.getProviderPreference();
      if (id !== preferredProvider || !fallbackProvider || fallbackProvider === id) throw err;

      // eslint-disable-next-line no-console -- visibilidad real de cuándo se activa el respaldo, no solo un error silencioso
      console.warn(
        `[ProviderRegistry] ${PROVIDER_LABEL[id]} falló (${(err as Error).message}) — reintentando con ${PROVIDER_LABEL[fallbackProvider]} (respaldo configurado).`,
      );
      return this.get(fallbackProvider).generateStructured(input);
    }
  }
}
