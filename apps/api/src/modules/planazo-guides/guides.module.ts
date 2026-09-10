import { Module } from '@nestjs/common';
import { PlanazoGuidesController } from './guides.controller';
import { CmsPlanazoGuidesController } from './cms-guides.controller';
import { PlanazoGuidesService } from './guides.service';

@Module({
  controllers: [PlanazoGuidesController, CmsPlanazoGuidesController],
  providers: [PlanazoGuidesService],
  exports: [PlanazoGuidesService], // AutomationModule lo usa para crear guías solas
})
export class PlanazoGuidesModule {}
