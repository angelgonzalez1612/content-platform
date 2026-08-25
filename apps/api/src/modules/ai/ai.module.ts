import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { OpenAiProvider } from './providers/openai-provider';
import { CONTENT_PROVIDER } from './content-provider.interface';

@Module({
  controllers: [AiController],
  providers: [{ provide: CONTENT_PROVIDER, useClass: OpenAiProvider }],
})
export class AiModule {}
