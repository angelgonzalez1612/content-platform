import { Module } from '@nestjs/common';
import { PlacesController } from './places.controller';
import { CmsPlacesController } from './cms-places.controller';
import { PlacesService } from './places.service';

@Module({
  controllers: [PlacesController, CmsPlacesController],
  providers: [PlacesService],
})
export class PlacesModule {}
