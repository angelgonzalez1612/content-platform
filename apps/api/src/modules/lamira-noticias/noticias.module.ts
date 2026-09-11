import { Module } from '@nestjs/common';
import { NoticiasController } from './noticias.controller';
import { CmsNoticiasController } from './cms-noticias.controller';
import { NoticiasService } from './noticias.service';
import { ContentVersionsModule } from '../content-versions/content-versions.module';

@Module({
  imports: [ContentVersionsModule],
  controllers: [NoticiasController, CmsNoticiasController],
  providers: [NoticiasService],
  exports: [NoticiasService], // AutomationModule lo usa para crear noticias solo
})
export class NoticiasModule {}
