import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiSettingsController } from './ai-settings.controller';
import { AiSettingsService } from './ai-settings.service';
import { OpenAiProvider } from './providers/openai-provider';
import { ClaudeCliProvider } from './providers/claude-cli-provider';
import { CodexCliProvider } from './providers/codex-cli-provider';
import { CONTENT_PROVIDER } from './content-provider.interface';
import { ChecksService } from './checks.service';
import { AiDraftService } from './ai-draft.service';
import { BlockImproveService } from './block-improve.service';
import { SeoGenerateService } from './seo-generate.service';
import { ProviderRegistry } from './provider-registry.service';
import { ArticleScraperService } from './article-scraper.service';
import { ImageSearchService } from './image-search.service';
import { ImageUploadService } from './image-upload.service';
import { GooglePlacesService } from './google-places.service';
import { CategoriesModule } from '../categories/categories.module';
import { PlacesModule } from '../places/places.module';

@Module({
  imports: [CategoriesModule, PlacesModule], // clasificación de categoría + catálogo real de lugares para planazo-guia, ambos en AiDraftService
  controllers: [AiController, AiSettingsController],
  providers: [
    // /cms/ai/generate-place (endpoint original) sigue OpenAI-only, sin tocar.
    { provide: CONTENT_PROVIDER, useClass: OpenAiProvider },
    OpenAiProvider,
    ClaudeCliProvider,
    CodexCliProvider,
    ProviderRegistry,
    ChecksService,
    ArticleScraperService,
    ImageSearchService,
    ImageUploadService,
    GooglePlacesService,
    AiDraftService,
    BlockImproveService,
    SeoGenerateService,
    AiSettingsService,
  ],
  exports: [AiDraftService], // AutomationModule lo usa para generar el borrador
})
export class AiModule {}
