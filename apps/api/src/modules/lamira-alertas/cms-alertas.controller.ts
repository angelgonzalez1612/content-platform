import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AlertasService } from './alertas.service';
import { createAlertaSchema, updateAlertaSchema } from './dto/alerta.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { RequestWithSession } from '../auth/jwt-auth.guard';
import { assertAdmin } from '../auth/assert-admin';
import { RevalidatesSite } from '../site-revalidation/revalidates-site.decorator';

@UseGuards(JwtAuthGuard)
@RevalidatesSite('la-mira')
@Controller('cms/lamira/alertas')
export class CmsAlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  @Get()
  findAll() {
    return this.alertasService.findAllForCms();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.alertasService.findByIdForCms(id);
  }

  @Post()
  create(@Body() body: unknown) {
    return this.alertasService.create(createAlertaSchema.parse(body));
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: unknown) {
    return this.alertasService.update(id, updateAlertaSchema.parse(body));
  }

  // Eliminar es solo para administradores (no hay papelera: queda una copia en
  // el historial de versiones, ver alertas.service.ts).
  @Delete(':id')
  remove(@Req() req: RequestWithSession, @Param('id') id: string) {
    assertAdmin(req);
    return this.alertasService.remove(id);
  }
}
