import { Module } from '@nestjs/common';
import { PlacesController } from './places.controller';
import { CmsPlacesController } from './cms-places.controller';
import { PlacesService } from './places.service';
import { ContentVersionsModule } from '../content-versions/content-versions.module';

@Module({
  imports: [ContentVersionsModule],
  controllers: [PlacesController, CmsPlacesController],
  providers: [PlacesService],
  exports: [PlacesService], // AutomationModule lo usa para crear lugares solo
})
export class PlacesModule {}
