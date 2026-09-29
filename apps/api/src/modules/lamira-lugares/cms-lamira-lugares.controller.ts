import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { LamiraLugaresService } from './lamira-lugares.service';
import { createLamiraLugarSchema, updateLamiraLugarSchema } from './dto/lamira-lugar.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithSession } from '../auth/jwt-auth.guard';
import { assertAdmin } from '../auth/assert-admin';
import { RevalidatesSite } from '../site-revalidation/revalidates-site.decorator';

@UseGuards(JwtAuthGuard)
@RevalidatesSite('la-mira')
@Controller('cms/lamira/lugares')
export class CmsLamiraLugaresController {
  constructor(private readonly lugaresService: LamiraLugaresService) {}

  @Get()
  findAll() {
    return this.lugaresService.findAllForCms();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.lugaresService.findByIdForCms(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.lugaresService.create(createLamiraLugarSchema.parse(body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.lugaresService.update(id, updateLamiraLugarSchema.parse(body));
  }

  // Eliminar es solo para administradores (no hay papelera: queda una copia en
  // el historial de versiones, ver lamira-lugares.service.ts).
  @Delete(':id')
  remove(@Req() req: RequestWithSession, @Param('id') id: string) {
    assertAdmin(req);
    return this.lugaresService.remove(id);
  }
}
