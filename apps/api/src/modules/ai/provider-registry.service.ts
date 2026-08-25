import { Injectable } from '@nestjs/common';
import type { ContentProvider } from './content-provider.interface';
import { OpenAiProvider } from './providers/openai-provider';
import { ClaudeCliProvider } from './providers/claude-cli-provider';

export const AI_PROVIDER_IDS = ['openai', 'claude-cli'] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

// Elegible por request (draftRequestSchema.provider / improveRequestSchema.provider)
// en vez de un único CONTENT_PROVIDER inyectado — openai da salida
// estructurada garantizada y cuesta por token; claude-cli usa la sesión de
// Claude Code ya autenticada en esta máquina (suscripción Pro/Max, no una
// API key nueva) pero sin esa garantía, valida+reintenta en su lugar.
@Injectable()
export class ProviderRegistry {
  constructor(
    private readonly openAiProvider: OpenAiProvider,
    private readonly claudeCliProvider: ClaudeCliProvider,
  ) {}

  get(id: AiProviderId): ContentProvider {
    return id === 'claude-cli' ? this.claudeCliProvider : this.openAiProvider;
  }
}
