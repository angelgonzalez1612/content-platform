import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import type { ContentProvider, StructuredGenerateInput } from './content-provider.interface';
import { OpenAiProvider } from './providers/openai-provider';
import { ClaudeCliProvider } from './providers/claude-cli-provider';
import { CodexCliProvider } from './providers/codex-cli-provider';
import { AiSettingsService } from './ai-settings.service';
import { ProviderHealthService, ProviderQuotaExceededError } from './provider-health';

export const AI_PROVIDER_IDS = ['openai', 'claude-cli', 'codex-cli'] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

// "default" = usar el proveedor predeterminado de Configuración al momento de
// correr (ver resolveProvider) — así cambiar de Claude a Codex para todas las
// reglas es un solo cambio en Configuración, no editar regla por regla.
export const DEFAULT_PROVIDER_CHOICE = 'default' as const;
export type AiProviderChoice = AiProviderId | typeof DEFAULT_PROVIDER_CHOICE;

// Si en Configuración no hay predeterminado guardado, se usa Codex.
export const FALLBACK_DEFAULT_PROVIDER: AiProviderId = 'codex-cli';

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
    private readonly health: ProviderHealthService,
  ) {}

  get(id: AiProviderId): ContentProvider {
    if (id === 'claude-cli') return this.claudeCliProvider;
    if (id === 'codex-cli') return this.codexCliProvider;
    return this.openAiProvider;
  }

  /** "default" → el predeterminado de Configuración (o Codex si no hay). */
  async resolveProvider(choice: AiProviderChoice): Promise<AiProviderId> {
    if (choice !== DEFAULT_PROVIDER_CHOICE) return choice;
    const { preferredProvider } = await this.aiSettings.getProviderPreference();
    return preferredProvider ?? FALLBACK_DEFAULT_PROVIDER;
  }

  /** Llamada a un solo proveedor, registrando el resultado en ProviderHealthService. */
  private async generateTracked<Schema extends z.ZodTypeAny>(
    id: AiProviderId,
    input: StructuredGenerateInput<Schema>,
  ): Promise<z.infer<Schema>> {
    try {
      const output = await this.get(id).generateStructured(input);
      this.health.recordSuccess(id);
      return output;
    } catch (err) {
      const message = (err as Error).message;
      if (this.health.recordFailure(id, message) === 'sin-tokens') {
        throw new ProviderQuotaExceededError(id, message);
      }
      throw err;
    }
  }

  /** Punto único que usan AiDraftService/BlockImproveService/SeoGenerateService
   * en vez de `get(id).generateStructured(...)` directo — si `id` es el
   * proveedor preferido configurado en Configuración y falla (CLI sin
   * sesión, límite alcanzado, timeout, lo que sea), reintenta UNA vez con el
   * de respaldo antes de fallar la generación completa. Sin preferencia
   * configurada, o pidiendo un proveedor que no es el preferido, se comporta
   * exactamente como antes (sin reintento — la elección explícita del
   * llamador manda). Si al final el error es de tokens, sale como
   * ProviderQuotaExceededError. */
  async generateWithFallback<Schema extends z.ZodTypeAny>(
    choice: AiProviderChoice,
    input: StructuredGenerateInput<Schema>,
  ): Promise<z.infer<Schema>> {
    const id = await this.resolveProvider(choice);
    try {
      return await this.generateTracked(id, input);
    } catch (err) {
      const { preferredProvider, fallbackProvider } = await this.aiSettings.getProviderPreference();
      if (id !== preferredProvider || !fallbackProvider || fallbackProvider === id) throw err;

      // eslint-disable-next-line no-console -- visibilidad real de cuándo se activa el respaldo, no solo un error silencioso
      console.warn(
        `[ProviderRegistry] ${PROVIDER_LABEL[id]} falló (${(err as Error).message.slice(0, 300)}) — reintentando con ${PROVIDER_LABEL[fallbackProvider]} (respaldo configurado).`,
      );
      return this.generateTracked(fallbackProvider, input);
    }
  }
}
