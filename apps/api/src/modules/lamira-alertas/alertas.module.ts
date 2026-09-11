import { Module } from '@nestjs/common';
import { AlertasController } from './alertas.controller';
import { CmsAlertasController } from './cms-alertas.controller';
import { AlertasService } from './alertas.service';
import { ContentVersionsModule } from '../content-versions/content-versions.module';

@Module({
  imports: [ContentVersionsModule],
  controllers: [AlertasController, CmsAlertasController],
  providers: [AlertasService],
  exports: [AlertasService], // AutomationModule lo usa para crear alertas solo
})
export class AlertasModule {}
