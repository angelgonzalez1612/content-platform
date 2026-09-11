import { Module } from '@nestjs/common';
import { ContentVersionsController } from './content-versions.controller';
import { ContentVersionsService } from './content-versions.service';

@Module({
  controllers: [ContentVersionsController],
  providers: [ContentVersionsService],
  exports: [ContentVersionsService], // los servicios de cada tipo de contenido lo usan para snapshot() antes de escribir
})
export class ContentVersionsModule {}
