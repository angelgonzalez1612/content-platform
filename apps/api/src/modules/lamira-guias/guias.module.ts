import { Module } from '@nestjs/common';
import { GuiasController } from './guias.controller';
import { CmsGuiasController } from './cms-guias.controller';
import { GuiasService } from './guias.service';

@Module({
  controllers: [GuiasController, CmsGuiasController],
  providers: [GuiasService],
})
export class GuiasModule {}
