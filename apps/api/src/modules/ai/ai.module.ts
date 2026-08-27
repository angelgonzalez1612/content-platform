import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { OpenAiProvider } from './providers/openai-provider';
import { ClaudeCliProvider } from './providers/claude-cli-provider';
import { CONTENT_PROVIDER } from './content-provider.interface';
import { ChecksService } from './checks.service';
import { AiDraftService } from './ai-draft.service';
import { ProviderRegistry } from './provider-registry.service';
import { ArticleScraperService } from './article-scraper.service';

@Module({
  controllers: [AiController],
  providers: [
    // /cms/ai/generate-place (endpoint original) sigue OpenAI-only, sin tocar.
    { provide: CONTENT_PROVIDER, useClass: OpenAiProvider },
    OpenAiProvider,
    ClaudeCliProvider,
    ProviderRegistry,
    ChecksService,
    ArticleScraperService,
    AiDraftService,
  ],
})
export class AiModule {}
