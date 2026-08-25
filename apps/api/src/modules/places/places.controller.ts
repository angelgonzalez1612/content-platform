import { Controller, Get, Param, Query } from '@nestjs/common';
import { PlacesService } from './places.service';
import { queryPlacesSchema } from './dto/query-places.dto';

@Controller('places')
export class PlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  findAll(@Query() query: Record<string, unknown>) {
    return this.placesService.findAll(queryPlacesSchema.parse(query));
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string) {
    return this.placesService.findBySlug(slug);
  }
}
