import { Injectable } from '@nestjs/common';
import type { ContentProvider } from './content-provider.interface';
import { OpenAiProvider } from './providers/openai-provider';
import { ClaudeCliProvider } from './providers/claude-cli-provider';
import { CodexCliProvider } from './providers/codex-cli-provider';

export const AI_PROVIDER_IDS = ['openai', 'claude-cli', 'codex-cli'] as const;
export type AiProviderId = (typeof AI_PROVIDER_IDS)[number];

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
  ) {}

  get(id: AiProviderId): ContentProvider {
    if (id === 'claude-cli') return this.claudeCliProvider;
    if (id === 'codex-cli') return this.codexCliProvider;
    return this.openAiProvider;
  }
}
