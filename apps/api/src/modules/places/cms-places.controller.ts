import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { PlacesService } from './places.service';
import { updatePlaceSchema } from './dto/update-place.dto';
import { createPlaceSchema } from './dto/create-place.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithSession } from '../auth/jwt-auth.guard';
import { assertAdmin } from '../auth/assert-admin';
import { RevalidatesSite } from '../site-revalidation/revalidates-site.decorator';

@UseGuards(JwtAuthGuard)
@RevalidatesSite('planazo')
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

  // Eliminar es solo para administradores (no hay papelera: queda una copia en
  // el historial de versiones, ver places.service.ts).
  @Delete(':id')
  remove(@Req() req: RequestWithSession, @Param('id') id: string) {
    assertAdmin(req);
    return this.placesService.remove(id);
  }
}
