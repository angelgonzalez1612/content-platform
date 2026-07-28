import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { PlacesService } from './places.service';
import { updatePlaceSchema } from './dto/update-place.dto';
import { createPlaceSchema } from './dto/create-place.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cms/places')
export class CmsPlacesController {
  constructor(private readonly placesService: PlacesService) {}

  @Get()
  findAll() {
    return this.placesService.findAllForCms();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.placesService.findByIdForCms(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.placesService.create(createPlaceSchema.parse(body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.placesService.update(id, updatePlaceSchema.parse(body));
  }
}
