import { Module } from '@nestjs/common';
import { NoticiasController } from './noticias.controller';
import { CmsNoticiasController } from './cms-noticias.controller';
import { NoticiasService } from './noticias.service';

@Module({
  controllers: [NoticiasController, CmsNoticiasController],
  providers: [NoticiasService],
})
export class NoticiasModule {}
