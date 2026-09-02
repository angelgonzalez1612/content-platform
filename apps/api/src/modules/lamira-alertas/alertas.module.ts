import { Module } from '@nestjs/common';
import { AlertasController } from './alertas.controller';
import { CmsAlertasController } from './cms-alertas.controller';
import { AlertasService } from './alertas.service';

@Module({
  controllers: [AlertasController, CmsAlertasController],
  providers: [AlertasService],
  exports: [AlertasService], // AutomationModule lo usa para crear alertas solo
})
export class AlertasModule {}
