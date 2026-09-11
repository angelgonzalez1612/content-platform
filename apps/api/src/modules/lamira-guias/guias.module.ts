import { Module } from '@nestjs/common';
import { GuiasController } from './guias.controller';
import { CmsGuiasController } from './cms-guias.controller';
import { GuiasService } from './guias.service';
import { ContentVersionsModule } from '../content-versions/content-versions.module';

@Module({
  imports: [ContentVersionsModule],
  controllers: [GuiasController, CmsGuiasController],
  providers: [GuiasService],
})
export class GuiasModule {}
