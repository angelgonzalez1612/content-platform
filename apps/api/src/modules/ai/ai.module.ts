import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { OpenAiProvider } from './providers/openai-provider';
import { CONTENT_PROVIDER } from './content-provider.interface';
import { ChecksService } from './checks.service';
import { AiDraftService } from './ai-draft.service';

@Module({
  controllers: [AiController],
  providers: [
    { provide: CONTENT_PROVIDER, useClass: OpenAiProvider },
    ChecksService,
    AiDraftService,
  ],
})
export class AiModule {}
