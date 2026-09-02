import { Controller, Get, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';

// Público, sin auth — CMS, La Mira y Planazo lo leen por igual como fuente
// única de las 16 alcaldías de CDMX + 19 municipios del Edomex (antes
// copiadas a mano en cada uno de los 3, ver comentario en db/schema/locations.ts).
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get()
  findAll(@Query('kind') kind?: 'alcaldia' | 'municipio') {
    return this.locationsService.findAll(kind);
  }
}
