import { Module } from '@nestjs/common';
import { LamiraEventosController } from './lamira-eventos.controller';
import { CmsLamiraEventosController } from './cms-lamira-eventos.controller';
import { LamiraEventosService } from './lamira-eventos.service';
import { ContentVersionsModule } from '../content-versions/content-versions.module';

@Module({
  imports: [ContentVersionsModule],
  controllers: [LamiraEventosController, CmsLamiraEventosController],
  providers: [LamiraEventosService],
})
export class LamiraEventosModule {}
